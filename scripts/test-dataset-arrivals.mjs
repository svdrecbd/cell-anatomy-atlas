import assert from "node:assert/strict";
import { test } from "node:test";
import { directDatasetIdentifier, recordDatasetArrival } from "../lib/dataset-arrivals.ts";

const recordUrl = "https://cellanatomy.org/datasets/egebjerg-2024-057";
const pageResponse = () => new Response("Dataset page", { headers: { "Content-Type": "text/html; charset=utf-8" } });

test("count outside arrivals without counting internal navigation or background requests", () => {
  for (const headers of [{}, { Referer: "https://mail.example.edu/" }, { "Sec-Fetch-Site": "none", "Sec-Fetch-Dest": "document" }]) {
    assert.equal(directDatasetIdentifier(new Request(recordUrl, { headers }), pageResponse()), "egebjerg-2024-057");
  }
  for (const headers of [
    { Referer: "https://cellanatomy.org/corpus" }, { Referer: "https://www.cellanatomy.org/compare" },
    { "Sec-Fetch-Site": "same-origin" }, { "Sec-Fetch-Site": "same-site" },
    { RSC: "1" }, { "Next-Router-Prefetch": "1" }, { "Sec-Purpose": "prefetch;prerender" },
    { Purpose: "prefetch" }, { "Sec-Fetch-Dest": "iframe" }, { "User-Agent": "Googlebot/2.1" },
    { "User-Agent": "python-urllib/3.12" }, { Referer: "invalid" }
  ]) assert.equal(directDatasetIdentifier(new Request(recordUrl, { headers }), pageResponse()), null);
  assert.equal(directDatasetIdentifier(new Request(recordUrl, { method: "HEAD" }), pageResponse()), null);
  assert.equal(directDatasetIdentifier(new Request(recordUrl), new Response("Missing", { status: 404 })), null);
  assert.equal(directDatasetIdentifier(new Request(recordUrl), new Response("{}", { headers: { "Content-Type": "application/json" } })), null);
  assert.equal(directDatasetIdentifier(new Request("https://cellanatomy.org/corpus"), pageResponse()), null);
  assert.equal(directDatasetIdentifier(new Request("https://preview.example/datasets/egebjerg-2024-057"), pageResponse()), null);
  const verifiedBotRequest = new Request(recordUrl);
  Object.defineProperty(verifiedBotRequest, "cf", { value: { botManagement: { verifiedBot: true } } });
  assert.equal(directDatasetIdentifier(verifiedBotRequest, pageResponse()), null);
});

test("background counting binds only the record and survives a storage failure", async () => {
  const promises = [];
  const boundValues = [];
  const database = {
    prepare(query) {
      assert.match(query, /ON CONFLICT/);
      return { bind(...values) { boundValues.push(values); return { async run() { throw new Error("Storage unavailable"); } }; } };
    }
  };
  const context = { waitUntil(promise) { promises.push(promise); } };
  const request = new Request(recordUrl, { headers: { "CF-Connecting-IP": "192.0.2.1", "User-Agent": "Mozilla/5.0" } });
  const response = pageResponse();
  recordDatasetArrival(request, response, database, context);
  assert.equal(await response.text(), "Dataset page");
  await Promise.all(promises);
  assert.deepEqual(boundValues, [["egebjerg-2024-057"]]);
  assert.equal(promises.length, 1);
});
