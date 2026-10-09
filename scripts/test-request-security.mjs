import assert from "node:assert/strict";
import test from "node:test";
import { isPrivateResourcePath, permittedRequestMethods, readBoundedJsonObject, RequestValidationError } from "../lib/request-security.ts";

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
  for (const pathname of ["/.env", "/server/.env.local", "/admin%2F.env", "/admin%252F.env", "/.git/config", "/.git-credentials", "/.ssh/id_rsa", "/.dev.vars.production", "/.env.development::$DATA"]) {
    assert.equal(isPrivateResourcePath(pathname), true, pathname);
  }
  for (const pathname of ["/", "/robots.txt", "/.well-known/security.txt", "/corpus", "/api/datasets/export", "/datasets/environment-2024"]) {
    assert.equal(isPrivateResourcePath(pathname), false, pathname);
  }
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
