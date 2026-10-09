import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(root, "lib/corpus-data.json");
const sourceUrl =
  process.env.ATLAS_CORPUS_EXPORT_URL ??
  "https://cellanatomy.org/api/datasets/export?format=json&borderline=true";

const response = await fetch(sourceUrl);
if (!response.ok) {
  throw new Error(`Corpus export failed: ${response.status} ${response.statusText}`);
}

const payload = await response.json();
if (!payload || !Array.isArray(payload) || payload.length === 0) {
  throw new Error("Corpus export returned no dataset records.");
}

const records = payload;
const ids = new Set(records.map((record) => record.dataset_id));
if (ids.size !== records.length || ids.has(null)) {
  throw new Error("Corpus export contains a missing or duplicate dataset ID.");
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
console.log(`Exported ${records.length} public metadata records to ${outputPath}.`);
