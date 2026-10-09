import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const report=JSON.parse(await readFile(process.argv[2] ?? 'review/network-after.json','utf8'));
for(const page of report.pages) {
  assert.equal(page.document.status,200,page.path);
  assert.ok(page.coldTransferBytes<=225*1024,`${page.path}: cold response-body budget 225 KiB`);
  assert.ok(page.javascriptTransferBytes<=165*1024,`${page.path}: JavaScript budget 165 KiB`);
  assert.ok(page.stylesheetTransferBytes<=10*1024,`${page.path}: stylesheet budget 10 KiB`);
  assert.equal(page.externalAssetUrls.length,0,`${page.path}: self-hosted assets`);
  for(const asset of page.assets) {
    assert.equal(asset.status,200,asset.path);
    if(asset.path.startsWith('/_next/static/')) assert.match(asset.cacheControl,/immutable/,asset.path);
    if(asset.decodedBytes>1024) assert.equal(asset.encoding,'gzip',asset.path);
  }
}
console.log(`Verified ${report.pages.length} cold-page payloads against transfer, script, stylesheet, compression, cache, and asset-origin budgets.`);
