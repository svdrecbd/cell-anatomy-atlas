import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createDatasetStructuredData, createSiteStructuredData, serializeStructuredData } from "../lib/structured-data.ts";

const records = JSON.parse(await readFile(new URL("../lib/corpus-data.json", import.meta.url), "utf8"));

test("structured metadata preserves publication identity and data availability across the corpus", () => {
  for (const record of records) {
    const metadata = JSON.parse(serializeStructuredData(createDatasetStructuredData(record)));
    assert.equal(metadata.identifier, record.dataset_id);
    assert.equal(metadata.name, record.title);
    assert.equal(metadata.citation.name, record.paper_title);
    assert.equal(metadata.measurementTechnique, record.modality);
    assert(metadata.description.includes(record.species));
    assert(metadata.description.includes(record.cell_type));
    assert.equal(metadata.url, `https://cellanatomy.org/datasets/${record.dataset_id}`);
    if (record.publication_pmid) assert.equal(metadata.citation.identifier, `PMID:${record.publication_pmid}`);
    // A source publication or repository landing page is not a direct download.
    assert.equal(metadata.distribution, undefined);
    assert.equal(metadata.license, undefined);
    assert.equal(metadata.creator, undefined);
    assert.equal(metadata.sameAs, undefined);
    if (record.public_data_status === "none") assert(metadata.description.includes("No public imaging data indexed"));
  }
  const catalog = createSiteStructuredData()["@graph"].find(entity => entity["@type"] === "DataCatalog");
  assert.equal(catalog["@id"], createDatasetStructuredData(records[0]).includedInDataCatalog["@id"]);
  assert.equal(catalog.citation.identifier, "https://doi.org/10.1186/s12915-026-02556-0");
});

test("untrusted corpus text cannot terminate a structured-data script", () => {
  const maliciousText = "</script><script>alert('example')</script>\u2028\u2029";
  const serialized = serializeStructuredData({ description: maliciousText });
  assert(!serialized.includes("<"));
  assert(!serialized.includes("\u2028"));
  assert(!serialized.includes("\u2029"));
  assert.equal(JSON.parse(serialized).description, maliciousText);
});
