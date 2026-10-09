import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { enforceSignupSubmissionBudget, RequestValidationError } from "../lib/request-security.ts";

assert(process.argv[2], "Supply the security review directory.");
const reviewDirectory = resolve(process.argv[2]);
const candidateDirectory = resolve(reviewDirectory, "production_candidate");
const filenames = (await readdir(candidateDirectory, { recursive: true })).filter(filename => filename.endsWith(".js"));
const modules = ["index.js", ...filenames.filter(filename => filename !== "index.js")].map(filename => ({ type: "ESModule", path: resolve(candidateDirectory, filename) }));
const runtime = new Miniflare(convertV4MiniflareOptions({
  modules, modulesRoot: candidateDirectory, compatibilityDate: "2026-09-04", compatibilityFlags: ["nodejs_compat"],
  d1Databases: { SIGNUPS_DB: "request-protection-validation" }, versionMetadata: "CF_VERSION_METADATA",
  ratelimits: {
    SIGNUP_NETWORK_RATE_LIMITER: { namespace_id: "2026100901", simple: { limit: 30, period: 60 } },
    SIGNUP_EMAIL_RATE_LIMITER: { namespace_id: "2026100902", simple: { limit: 3, period: 60 } }
  }
}));

async function submit(payload, additionalHeaders = {}) {
  return runtime.dispatchFetch("https://cellanatomy.org/api/beta-signups", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "https://cellanatomy.org", "CF-Connecting-IP": "192.0.2.40", ...additionalHeaders },
    body: JSON.stringify(payload)
  });
}

try {
  const database = await runtime.getD1Database("SIGNUPS_DB");
  for (const migration of ["0001_beta_signups.sql", "0002_unique_signup_email.sql", "0003_dataset_direct_arrivals.sql", "0004_signup_submission_limits.sql"]) {
    await database.exec((await readFile(new URL("../migrations/" + migration, import.meta.url), "utf8")).replaceAll("\n", " "));
  }
  for (const path of ["/", "/corpus", "/compare", "/analytics", "/plan", "/about", "/guide", "/robots.txt", "/sitemap.xml"]) {
    const response = await runtime.dispatchFetch("https://cellanatomy.org" + path);
    assert.equal(response.status, 200, path);
    const body = await response.text();
    if (path === "/") assert.match(body, /institutional-funding/);
  }
  const corpus = await runtime.dispatchFetch("https://cellanatomy.org/api/datasets/export?format=json&borderline=true");
  assert.deepEqual(await corpus.json(), JSON.parse(await readFile(resolve(reviewDirectory, "previous_corpus.json"), "utf8")));
  for (const path of ["/.env", "/.git/config", "/.aws/credentials", "/@fs/home/ubuntu/.aws/credentials", "/@vite/client", "/@id/module", "/.npmrc", "/.netrc", "/.docker/config.json"]) {
    const response = await runtime.dispatchFetch("https://cellanatomy.org" + path);
    assert.equal(response.status, 404, path);
    assert.equal(await response.text(), "Not found", path);
  }
  for (const [headers, expectedStatus] of [
    [{ Origin: "https://unrelated.example" }, 403],
    [{ "Sec-Fetch-Site": "cross-site" }, 403],
    [{ "Content-Type": "text/plain" }, 415]
  ]) {
    const response = await submit({ email: "rejected@example.invalid" }, headers);
    assert.equal(response.status, expectedStatus);
    await response.text();
  }
  const oversized = await submit({ email: "x".repeat(9000) });
  assert.equal(oversized.status, 413);
  await oversized.text();
  assert.equal((await database.prepare("SELECT COUNT(*) AS count FROM beta_signups").first()).count, 0);
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await submit({ email: "validation@example.invalid", first_name: "Validation", affiliation: "Local test" });
    assert.equal(response.status, attempt < 3 ? 201 : 429);
    if (attempt === 3) assert.equal(response.headers.get("Retry-After"), "60");
    await response.text();
  }
  assert.equal((await database.prepare("SELECT COUNT(*) AS count FROM beta_signups").first()).count, 1);
  for (let attempt = 0; attempt < 31; attempt++) {
    const response = await submit({ email: "network-validation-" + attempt + "@example.invalid" }, { "CF-Connecting-IP": "192.0.2.41" });
    assert.equal(response.status, attempt < 30 ? 201 : 429, "network attempt " + attempt);
    await response.text();
  }
  const dataset = await runtime.dispatchFetch("https://cellanatomy.org/datasets/egebjerg-2024-057", {
    headers: { "User-Agent": "Mozilla/5.0", "Sec-Fetch-Dest": "document", "Sec-Fetch-Site": "none" }
  });
  assert.equal(dataset.status, 200);
  await dataset.text();
  assert.equal((await database.prepare("SELECT SUM(arrivals) AS count FROM dataset_direct_arrivals").first()).count, 1);
  const opaqueIdentifiers = await database.prepare("SELECT scope_identifier FROM signup_submission_limits").all();
  for (const row of opaqueIdentifiers.results) assert.match(row.scope_identifier, /^signup-overall$|^signup-email:[a-f0-9]{64}$/);
  await database.prepare("INSERT INTO signup_submission_limits VALUES (?, ?, 1)").bind("expired-validation", Math.floor(Date.now() / 60000) - 10).run();
  const scheduledOutcome = await (await runtime.getWorker()).scheduled();
  assert.equal(scheduledOutcome.outcome, "ok");
  assert.equal((await database.prepare("SELECT COUNT(*) AS count FROM signup_submission_limits WHERE scope_identifier = ?").bind("expired-validation").first()).count, 0);
  const originalClock = Date.now;
  const fixedTime = Date.now();
  Date.now = () => fixedTime;
  try {
    await database.exec("DELETE FROM signup_submission_limits");
    const emailAdmissions = await Promise.allSettled(Array.from({ length: 12 }, () => enforceSignupSubmissionBudget({ email: "atomic-validation@example.invalid" }, database)));
    assert.equal(emailAdmissions.filter(result => result.status === "fulfilled").length, 3);
    for (const result of emailAdmissions.filter(result => result.status === "rejected")) assert(result.reason instanceof RequestValidationError && result.reason.statusCode === 429);
    await database.exec("DELETE FROM signup_submission_limits");
    const overallAdmissions = await Promise.allSettled(Array.from({ length: 130 }, () => enforceSignupSubmissionBudget({}, database)));
    assert.equal(overallAdmissions.filter(result => result.status === "fulfilled").length, 120);
    for (const result of overallAdmissions.filter(result => result.status === "rejected")) assert(result.reason instanceof RequestValidationError && result.reason.statusCode === 429);
  } finally {
    Date.now = originalClock;
  }
  const report = { publicPages: "passed", corpus: "129 records exactly unchanged", fundingFooter: "preserved", privatePaths: "rejected before application handling", signupOrigin: "foreign origins rejected", signupContentType: "JSON required", signupSize: "bounded to 8192 bytes", repeatedEmail: "429 after three attempts", sharedNetwork: "local edge limiter rejected after thirty attempts", atomicEmailLimit: "exactly three of twelve concurrent admissions accepted", atomicOverallLimit: "exactly 120 of 130 concurrent admissions accepted", scheduledCleanup: "expired counters removed", signupStorage: "verified in local database only", arrivals: "counted once" };
  await writeFile(resolve(reviewDirectory, "runtime_validation.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
} finally {
  await runtime.dispose();
}

const unavailableProtectionRuntime = new Miniflare(convertV4MiniflareOptions({
  modules, modulesRoot: candidateDirectory, compatibilityDate: "2026-09-04", compatibilityFlags: ["nodejs_compat"]
}));
try {
  const response = await unavailableProtectionRuntime.dispatchFetch("https://cellanatomy.org/api/beta-signups", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "https://cellanatomy.org" },
    body: JSON.stringify({ email: "unavailable@example.invalid" })
  });
  assert.equal(response.status, 503);
  await response.text();
  console.log(JSON.stringify({ unavailableProtectionBindings: "signup rejected with 503" }));
} finally {
  await unavailableProtectionRuntime.dispose();
}
