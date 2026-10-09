import type { MetadataRoute } from "next";
import corpusRecords from "../lib/corpus-data.json";
import { PUBLIC_SITE_ORIGIN, SEARCH_PAGES } from "../lib/search-metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    ...Object.keys(SEARCH_PAGES),
    ...corpusRecords
      .filter(record => ["included", "borderline"].includes(record.included_status))
      .map(record => `/datasets/${encodeURIComponent(record.dataset_id)}`)
  ];
  return [...new Set(paths)].map(path => ({ url: new URL(path, PUBLIC_SITE_ORIGIN).href }));
}
