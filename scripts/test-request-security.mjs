import assert from "node:assert/strict";
import test from "node:test";
import { enforceSignupRateLimits, isPrivateResourcePath, permittedRequestMethods, readBoundedJsonObject, RequestValidationError, validateSignupRequest } from "../lib/request-security.ts";

const requestOrigin = "https://cellanatomy.org/api/beta-signups";
const encoder = new TextEncoder();

test("public pages and exports permit reading while writes are confined to the signup endpoint", () => {
  for (const pathname of ["/", "/corpus", "/api/datasets/export", "/api/admin", "/api/beta-signups/other"]) {
    assert.deepEqual(permittedRequestMethods(pathname), ["GET", "HEAD"]);
  }
  for (const pathname of ["/api/beta-signups", "/api/beta-signups/"]) {
    assert.deepEqual(permittedRequestMethods(pathname), ["GET", "HEAD", "POST"]);
  }
});

test("private configuration and credential requests are rejected through encoded paths", () => {
  for (const pathname of ["/.env", "/server/.env.local", "/admin%2F.env", "/admin%252F.env", "/.git/config", "/.git-credentials", "/.ssh/id_rsa", "/.dev.vars.production", "/.env.development::$DATA", "/@fs/home/ubuntu/.aws/credentials", "/@vite/client", "/@id/module", "/server/.npmrc", "/.docker/config.json", "/.netrc", "/.pypirc", "/%40fs/home/user/file"]) {
    assert.equal(isPrivateResourcePath(pathname), true, pathname);
  }
  for (const pathname of ["/", "/robots.txt", "/.well-known/security.txt", "/corpus", "/api/datasets/export", "/datasets/environment-2024"]) {
    assert.equal(isPrivateResourcePath(pathname), false, pathname);
  }
});

test("signup requests reject foreign origins, opaque origins, and non-JSON browser submissions", () => {
  for (const headers of [
    { Origin: "https://unrelated.example", "Content-Type": "application/json" },
    { Origin: "null", "Content-Type": "application/json" },
    { "Sec-Fetch-Site": "cross-site", "Content-Type": "application/json" },
    { Origin: "https://cellanatomy.org", "Content-Type": "text/plain" },
    { Origin: "https://cellanatomy.org", "Content-Type": "application/x-www-form-urlencoded" }
  ]) {
    assert.throws(() => validateSignupRequest(new Request(requestOrigin, { method: "POST", headers, body: "{}" })), error => error instanceof RequestValidationError && [403, 415].includes(error.statusCode));
  }
  for (const headers of [
    { Origin: "https://cellanatomy.org", "Content-Type": "application/json; charset=UTF-8", "Sec-Fetch-Site": "same-origin" },
    { "Content-Type": "application/json" }
  ]) validateSignupRequest(new Request(requestOrigin, { method: "POST", headers, body: "{}" }));
});

test("signup limits use opaque identifiers and normalize repeated email submissions", async () => {
  const networkKeys = [];
  const emailKeys = [];
  const environment = {
    SIGNUP_NETWORK_RATE_LIMITER: { async limit({ key }) { networkKeys.push(key); return { success: true }; } },
    SIGNUP_EMAIL_RATE_LIMITER: { async limit({ key }) { emailKeys.push(key); return { success: emailKeys.length < 2 }; } }
  };
  const request = new Request(requestOrigin, { headers: { "CF-Connecting-IP": "192.0.2.40" } });
  await enforceSignupRateLimits(request, { email: " Researcher@Example.org " }, environment);
  await assert.rejects(enforceSignupRateLimits(request, { email: "researcher@example.org" }, environment), error => error instanceof RequestValidationError && error.statusCode === 429);
  assert.equal(emailKeys[0], emailKeys[1]);
  for (const key of [...networkKeys, ...emailKeys]) {
    assert.match(key, /^signup-(network|email):[a-f0-9]{64}$/);
    assert.equal(key.includes("192.0.2.40") || key.includes("researcher@example.org"), false);
  }
  environment.SIGNUP_NETWORK_RATE_LIMITER.limit = async () => ({ success: false });
  await assert.rejects(enforceSignupRateLimits(request, {}, environment), error => error.statusCode === 429);
});

test("a streamed payload is rejected and cancelled before the entire body is read", async () => {
  let cancelled = false;
  let suppliedChunks = 0;
  const body = new ReadableStream({
    pull(controller) {
      suppliedChunks++;
      controller.enqueue(encoder.encode("x".repeat(1024)));
    },
    cancel() { cancelled = true; }
  });
  const request = new Request(requestOrigin, { method: "POST", body, duplex: "half" });
  await assert.rejects(readBoundedJsonObject(request, 2048), (error) => error instanceof RequestValidationError && error.statusCode === 413);
  assert.equal(cancelled, true);
  assert.ok(suppliedChunks <= 4, "the reader must stop promptly at the body limit");
});

test("a misleading content-length does not bypass the streamed payload limit", async () => {
  const request = new Request(requestOrigin, { method: "POST", headers: { "Content-Length": "1" }, body: JSON.stringify({ email: "x".repeat(3000) }) });
  await assert.rejects(readBoundedJsonObject(request, 2048), (error) => error.statusCode === 413);
});

test("the payload limit measures UTF-8 bytes rather than characters", async () => {
  const request = new Request(requestOrigin, { method: "POST", body: JSON.stringify({ affiliation: "学".repeat(40) }) });
  await assert.rejects(readBoundedJsonObject(request, 100), (error) => error.statusCode === 413);
});

test("JSON primitives, arrays, malformed JSON, and malformed UTF-8 are rejected", async () => {
  for (const body of ["null", "[]", "1", '"text"', "{", new Uint8Array([0xff, 0xfe])]) {
    const request = new Request(requestOrigin, { method: "POST", body });
    await assert.rejects(readBoundedJsonObject(request, 8192), (error) => error instanceof RequestValidationError && error.statusCode === 400);
  }
});

test("valid JSON remains intact when a multibyte character crosses stream chunks", async () => {
  const payload = { email: "researcher@example.org", affiliation: "Université" };
  const encodedBody = encoder.encode(JSON.stringify(payload));
  const body = new ReadableStream({
    start(controller) {
      for (const byte of encodedBody) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    }
  });
  const request = new Request(requestOrigin, { method: "POST", body, duplex: "half" });
  assert.deepEqual(await readBoundedJsonObject(request, 8192), payload);
});
