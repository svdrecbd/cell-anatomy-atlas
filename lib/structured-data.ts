import type { DatasetRecord } from "./types";

const siteOrigin = "https://cellanatomy.org";
const catalogIdentifier = `${siteOrigin}/corpus#catalog`;
const corpusPublication = "https://doi.org/10.1186/s12915-026-02556-0";

export function serializeStructuredData(value: unknown): string {
  // Prevent a corpus string from terminating the containing script element.
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function createSiteStructuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteOrigin}/#website`,
        name: "Cell Anatomy",
        alternateName: "Cell Anatomy Atlas",
        url: `${siteOrigin}/`,
        description: "A free atlas for exploring and comparing whole-cell imaging studies from the Cell Anatomy scoping review.",
        inLanguage: "en",
        about: { "@id": catalogIdentifier }
      },
      {
        "@type": "DataCatalog",
        "@id": catalogIdentifier,
        name: "Cell Anatomy whole-cell imaging corpus",
        url: `${siteOrigin}/corpus`,
        description: "Curated study records describing whole-cell imaging methods, organisms, organelles, measurements, and source publications. Imaging data availability is documented separately for each record.",
        citation: {
          "@type": "CreativeWork",
          additionalType: "https://schema.org/ScholarlyArticle",
          name: "A scoping study of the whole-cell imaging literature as a foundation for the emerging field of cell anatomy",
          url: corpusPublication,
          identifier: "https://doi.org/10.1186/s12915-026-02556-0",
          datePublished: "2026"
        }
      }
    ]
  };
}

export function createDatasetStructuredData(dataset: DatasetRecord) {
  const recordUrl = `${siteOrigin}/datasets/${encodeURIComponent(dataset.dataset_id)}`;
  const publicationUrl = dataset.source_publication_url || (dataset.publication_pmid ? `https://pubmed.ncbi.nlm.nih.gov/${dataset.publication_pmid}/` : undefined);
  const sampleDescription = dataset.sample_size == null ? "Sample size not reported." : `Reported sample size: ${dataset.sample_size} cells.`;
  const availabilityDescription = dataset.public_data_status === "complete" ? "Public data indexed as complete." : dataset.public_data_status === "partial" ? "Public data indexed as partial." : dataset.public_data_status === "unknown" ? "Public imaging data availability not established in this record." : "No public imaging data indexed in this record.";
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": `${recordUrl}#dataset`,
    name: dataset.title,
    description: `${dataset.cell_type} (${dataset.species}) whole-cell imaging using ${dataset.modality}, described in ${dataset.paper_title} (${dataset.year}, ${dataset.source}). ${sampleDescription} ${availabilityDescription}${dataset.notes ? ` Curation notes: ${dataset.notes}` : ""}`,
    url: recordUrl,
    identifier: dataset.dataset_id,
    measurementTechnique: dataset.modality,
    keywords: [...new Set(["whole-cell imaging", dataset.species, dataset.cell_type, dataset.modality, ...dataset.organelles])],
    variableMeasured: dataset.metric_families,
    includedInDataCatalog: {
      "@type": "DataCatalog",
      "@id": catalogIdentifier,
      name: "Cell Anatomy whole-cell imaging corpus",
      url: `${siteOrigin}/corpus`
    },
    citation: {
      "@type": "CreativeWork",
      additionalType: "https://schema.org/ScholarlyArticle",
      name: dataset.paper_title,
      datePublished: String(dataset.year),
      ...(publicationUrl ? { url: publicationUrl } : {}),
      ...(dataset.publication_pmid ? { identifier: `PMID:${dataset.publication_pmid}` } : {}),
      isPartOf: { "@type": "Periodical", name: dataset.source }
    }
    // Source authors, licenses and direct download formats are not supplied by
    // the corpus. Do not infer them or apply the atlas metadata license to images.
  };
}
