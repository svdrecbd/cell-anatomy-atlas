import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

const origin = process.argv[2];
assert(origin, "Supply the public or local site origin.");
const recordsResponse = await fetch(`${origin}/api/datasets/export?format=json&borderline=true`, { headers: { "User-Agent": "CellAnatomyMetadataValidationBot/1.0" } });
assert.equal(recordsResponse.status, 200);
const records = await recordsResponse.json();
assert.equal(records.length, 129);

function metadataScripts(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(match => /type="application\/ld\+json"/.test(match[1]))
    .map(match => JSON.parse(match[2]));
}

const homepage = await fetch(origin);
assert.equal(homepage.status, 200);
const homeHtml = await homepage.text();
const site = metadataScripts(homeHtml).find(value => value["@graph"]);
assert(site["@graph"].some(value => value["@type"] === "WebSite" && value.name === "Cell Anatomy"));
assert.match(homeHtml, /<meta name="msvalidate\.01" content="3BDAA3C770AEDE825F71A33CCB4003CC"/);
for (let offset = 0; offset < records.length; offset += 4) {
  await Promise.all(records.slice(offset, offset + 4).map(async record => {
    const response = await fetch(`${origin}/datasets/${record.dataset_id}`, { headers: { "User-Agent": "CellAnatomyMetadataValidationBot/1.0" } });
    assert.equal(response.status, 200, record.dataset_id);
    const html = await response.text();
    const scripts = metadataScripts(html);
    const datasets = scripts.filter(value => value["@type"] === "Dataset");
    assert.equal(datasets.length, 1, record.dataset_id);
    const dataset = datasets[0];
    assert.equal(dataset.identifier, record.dataset_id);
    assert.equal(dataset.name, record.title);
    assert.equal(dataset.citation.name, record.paper_title);
    assert.equal(dataset.measurementTechnique, record.modality);
    assert.equal(dataset.url, `https://cellanatomy.org/datasets/${record.dataset_id}`);
    assert.equal(dataset.license, undefined);
    assert.equal(dataset.distribution, undefined);
    if (record.notes) assert(dataset.description.includes(record.notes));
    assert.match(html, new RegExp('<link rel="canonical" href="https://cellanatomy.org/datasets/' + record.dataset_id + '"'));
    assert(!/<meta name="robots" content="[^"]*noindex/.test(html));
  }));
}
const missing = await fetch(`${origin}/datasets/metadata-validation-missing-record`);
assert.equal(missing.status, 404);
assert(!metadataScripts(await missing.text()).some(value => value["@type"] === "Dataset"));
const filtered = await fetch(`${origin}/corpus?modality=SXT`);
assert.match(await filtered.text(), /<meta name="robots" content="[^"]*noindex/);
const robots = await (await fetch(`${origin}/robots.txt`)).text();
assert.match(robots, /Allow: \/\s/);
assert.match(robots, /Disallow: \/api\//);
const sitemap = await (await fetch(`${origin}/sitemap.xml`)).text();
assert.equal([...sitemap.matchAll(/<loc>/g)].length, 136);
const result = { origin, recordsValidated: records.length, siteIdentity: "passed", publicationIdentity: "passed", unsupportedLicenseAndDownloadClaims: "absent", canonicalUrls: "passed", missingRecord: 404, filteredResults: "noindex", sitemapUrls: 136, crawlerPolicy: "public pages allowed; API excluded" };
if (process.argv[3]) await writeFile(process.argv[3], JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
