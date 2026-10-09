import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8788";
const publicOrigin = "https://cellanatomy.org";
const records = JSON.parse(await readFile(new URL("../lib/corpus-data.json", import.meta.url), "utf8"));

function decodeAttribute(value) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(match => [match[1], decodeAttribute(match[2])]));
}

async function inspectPage(path, canonicalPath, index, expectedTitle) {
  const response = await fetch(new URL(path, baseUrl));
  assert.equal(response.status, 200, path);
  const html = await response.text();
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
  assert.ok(head, `${path}: metadata must be in the initial HTML head`);
  const title = decodeAttribute(head.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  assert.ok(title.includes(expectedTitle), `${path}: descriptive title`);
  const links = [...head.matchAll(/<link\b[^>]*>/gi)].map(match => attributes(match[0]));
  const canonicals = links.filter(link => link.rel === "canonical");
  assert.equal(canonicals.length, 1, `${path}: exactly one canonical`);
  assert.equal(new URL(canonicals[0].href).href, new URL(canonicalPath, publicOrigin).href, path);
  const metadata = [...head.matchAll(/<meta\b[^>]*>/gi)].map(match => attributes(match[0]));
  const description = metadata.find(item => item.name === "description")?.content;
  assert.ok(description?.length > 40, `${path}: substantive description`);
  const robots = metadata.find(item => item.name === "robots")?.content ?? "";
  assert.match(robots, index ? /(?:^|,\s*)index(?:,|$)/ : /(?:^|,\s*)noindex(?:,|$)/, path);
  assert.match(robots, /(?:^|,\s*)follow(?:,|$)/, path);
  assert.equal(new URL(metadata.find(item => item.property === "og:url")?.content).href, new URL(canonicals[0].href).href, path);
  return title;
}

const mainPages = [
  ["/", "Whole-Cell Imaging Dataset Atlas"],
  ["/corpus", "Whole-Cell Imaging Corpus"],
  ["/analytics", "Whole-Cell Imaging Analytics"],
  ["/plan", "Whole-Cell Imaging Experiment Planner"],
  ["/compare", "Compare Whole-Cell Imaging Datasets"],
  ["/about", "About the Whole-Cell Imaging Atlas"],
  ["/guide", "Whole-Cell Imaging Atlas Documentation"]
];
const titles = [];
for (const [path, title] of mainPages) titles.push(await inspectPage(path, path, true, title));
assert.equal(new Set(titles).size, mainPages.length, "Main pages must have distinct titles");

await inspectPage("/corpus?view=table&utm_source=review", "/corpus", true, "Corpus");
await inspectPage("/corpus?sample_size_bucket=2-10", "/corpus?sample_size_bucket=2-10", false, "Corpus");
await inspectPage("/analytics?sample_size_bucket=2-10", "/analytics?sample_size_bucket=2-10", false, "Analytics");
await inspectPage("/corpus?query=choanocyte&view=table", "/corpus?query=choanocyte", false, "Corpus");
await inspectPage("/corpus?pair=er%3Anucleus&modality=FIB-SEM", "/corpus?modality=FIB-SEM&pair=er%3Anucleus", false, "Corpus");
await inspectPage("/corpus?pair=er%3Anucleus&family=EM", "/corpus?family=EM&pair=er%3Anucleus", false, "Corpus");

const legacyCases = [
  ["/corpus?pair=er%3Anucleus&family=FIB-SEM", "/corpus?pair=er%3Anucleus&modality=FIB-SEM"],
  ["/corpus?family=fib-sem&view=table&utm_source=review", "/corpus?view=table&utm_source=review&modality=FIB-SEM"],
  ["/corpus?family=FIB-SEM&modality=SXT&pair=er%3Anucleus", "/corpus?modality=SXT&pair=er%3Anucleus"]
];
for (const [legacyPath, correctedPath] of legacyCases) {
  const response = await fetch(new URL(legacyPath, baseUrl), { redirect: "manual" });
  assert.equal(response.status, 308, `${legacyPath}: permanent correction`);
  assert.equal(new URL(response.headers.get("location"), baseUrl).href, new URL(correctedPath, baseUrl).href, `${legacyPath}: preserve valid filters`);
  if (process.argv.includes("--worker")) assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/, `${legacyPath}: HTTP indexing exclusion`);
}

const pairResponse = await fetch(new URL("/corpus?pair=er%3Anucleus", baseUrl));
const pairHtml = await pairResponse.text();
assert.match(pairHtml, /href="\/corpus\?[^"<>]*modality=FIB-SEM/, "Common-method links must use the modality parameter");
assert.doesNotMatch(pairHtml, /href="\/corpus\?[^"<>]*family=FIB-SEM/, "Do not generate legacy method-as-family links");
if (process.argv.includes("--worker")) assert.match(pairResponse.headers.get("x-robots-tag") ?? "", /noindex/, "Filtered pages need an HTTP indexing exclusion");
await inspectPage("/plan?organelles=nucleus&precedent_public=partial", "/plan?organelles=nucleus&precedent_public=partial", false, "Planner");
await inspectPage("/compare?ids=deshmukh-2024-092,deshmukh-2024-093", "/compare?ids=deshmukh-2024-092%2Cdeshmukh-2024-093", false, "Compare");
await inspectPage("/datasets/deshmukh-2024-092", "/datasets/deshmukh-2024-092", true, "alpha cell: SXT Dataset (2024)");
await inspectPage("/datasets/deshmukh-2024-093", "/datasets/deshmukh-2024-093", true, "beta cell: SXT Dataset (2024)");

const robotsResponse = await fetch(new URL("/robots.txt", baseUrl));
assert.equal(robotsResponse.status, 200);
const robotsText = await robotsResponse.text();
assert.match(robotsText, /User-Agent: \*/i);
assert.match(robotsText, /^Allow: \/$/m);
assert.match(robotsText, /Sitemap: https:\/\/cellanatomy\.org\/sitemap\.xml/);

const sitemapResponse = await fetch(new URL("/sitemap.xml", baseUrl));
assert.equal(sitemapResponse.status, 200);
const sitemapText = await sitemapResponse.text();
assert.match(sitemapResponse.headers.get("content-type") ?? "", /xml/);
const urls = [...sitemapText.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => decodeAttribute(match[1]));
const expectedUrls = [
  ...mainPages.map(([path]) => new URL(path, publicOrigin).href),
  ...records.filter(record => ["included", "borderline"].includes(record.included_status))
    .map(record => `${publicOrigin}/datasets/${encodeURIComponent(record.dataset_id)}`)
];
assert.deepEqual([...urls].sort(), [...new Set(expectedUrls)].sort());
assert.ok(urls.every(url => !new URL(url).search), "Sitemap excludes result variations");

const missingDataset = await fetch(new URL("/datasets/nonexistent-dataset-record", baseUrl));
assert.equal(missingDataset.status, 404, "Unknown dataset records must not become indexable soft 404s");
console.log(`Search metadata verified: 17 page cases, 3 legacy-filter redirects, method links, robots.txt, ${urls.length} sitemap URLs, and dataset 404 handling.`);
