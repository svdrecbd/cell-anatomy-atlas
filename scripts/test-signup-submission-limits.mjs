import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { enforceSignupSubmissionBudget, purgeExpiredSignupCounters, RequestValidationError } from "../lib/request-security.ts";

test("atomic signup counters enforce email and overall limits under concurrency and remove expired windows", async () => {
  const runtime = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: "export default { fetch() { return new Response('Validation'); } };",
    compatibilityDate: "2026-09-04", d1Databases: { SIGNUPS_DB: "signup-admission-validation" }
  }));
  const originalClock = Date.now;
  const fixedTime = Date.now();
  Date.now = () => fixedTime;
  try {
    const database = await runtime.getD1Database("SIGNUPS_DB");
    await database.exec((await readFile(new URL("../migrations/0004_signup_submission_limits.sql", import.meta.url), "utf8")).replaceAll("\n", " "));
    const emailAdmissions = await Promise.allSettled(Array.from({ length: 12 }, (_, index) => enforceSignupSubmissionBudget({ email: index % 2 ? " RESEARCHER@EXAMPLE.INVALID " : "researcher@example.invalid" }, database)));
    assert.equal(emailAdmissions.filter(result => result.status === "fulfilled").length, 3);
    for (const result of emailAdmissions.filter(result => result.status === "rejected")) assert(result.reason instanceof RequestValidationError && result.reason.statusCode === 429);
    const identifiers = await database.prepare("SELECT scope_identifier FROM signup_submission_limits").all();
    for (const row of identifiers.results) assert.match(row.scope_identifier, /^signup-overall$|^signup-email:[a-f0-9]{64}$/);
    await database.exec("DELETE FROM signup_submission_limits");
    const overallAdmissions = await Promise.allSettled(Array.from({ length: 130 }, () => enforceSignupSubmissionBudget({}, database)));
    assert.equal(overallAdmissions.filter(result => result.status === "fulfilled").length, 120);
    for (const result of overallAdmissions.filter(result => result.status === "rejected")) assert(result.reason instanceof RequestValidationError && result.reason.statusCode === 429);
    await database.prepare("INSERT INTO signup_submission_limits VALUES (?, ?, 1)").bind("expired-validation", Math.floor(fixedTime / 60000) - 10).run();
    await purgeExpiredSignupCounters(database);
    assert.equal((await database.prepare("SELECT COUNT(*) AS count FROM signup_submission_limits WHERE scope_identifier = ?").bind("expired-validation").first()).count, 0);
    assert.equal((await database.prepare("SELECT COUNT(*) AS count FROM signup_submission_limits WHERE scope_identifier = ?").bind("signup-overall").first()).count, 1);
  } finally {
    Date.now = originalClock;
    await runtime.dispose();
  }
});
