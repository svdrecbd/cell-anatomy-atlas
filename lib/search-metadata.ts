import type { Metadata } from "next";
import { normalizeSearchParams, type RouteSearchParams } from "./route-props";

export const PUBLIC_SITE_ORIGIN = "https://cellanatomy.org";

export const SEARCH_PAGES = {
  "/": {
    title: "Cell Anatomy — Whole-Cell Imaging Dataset Atlas",
    description: "Search and compare 129 whole-cell imaging records. Explore cell types, organelles, microscopy methods, public data, and experimental precedent."
  },
  "/corpus": {
    title: "Whole-Cell Imaging Corpus | Cell Anatomy",
    description: "Find whole-cell imaging datasets by cell type, organelle, microscopy method, and public-data availability, with citations and technical metadata."
  },
  "/analytics": {
    title: "Whole-Cell Imaging Analytics | Cell Anatomy",
    description: "Explore whole-cell microscopy coverage, resolution and sample-size tradeoffs, organelle measurements, and public-data reporting across the corpus."
  },
  "/plan": {
    title: "Whole-Cell Imaging Experiment Planner | Cell Anatomy",
    description: "Find literature precedent for proposed whole-cell imaging studies using organelle targets, voxel size, sample size, and microscopy methods."
  },
  "/compare": {
    title: "Compare Whole-Cell Imaging Datasets | Cell Anatomy",
    description: "Compare whole-cell imaging records by cell type, species, organelles, microscopy methods, and technical metadata, with source-study caveats."
  },
  "/about": {
    title: "About the Whole-Cell Imaging Atlas | Cell Anatomy",
    description: "Learn how the Cell Anatomy Atlas builds on the Mirvis et al. whole-cell imaging scoping review, with scientific provenance and source links."
  },
  "/guide": {
    title: "Whole-Cell Imaging Atlas Documentation | Cell Anatomy",
    description: "Understand dataset inclusion, public-data status, voxel sizes, metadata completeness, and comparison scores in the Cell Anatomy imaging corpus."
  }
} as const;

export type SearchPagePath = keyof typeof SEARCH_PAGES;

export function createPageMetadata(
  path: string,
  title: string,
  description: string,
  index = true
): Metadata {
  const canonical = new URL(path, PUBLIC_SITE_ORIGIN).href;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: { index, follow: true },
    openGraph: { title, description, url: canonical, siteName: "Cell Anatomy", type: "website" }
  };
}

export function createSearchPageMetadata(path: SearchPagePath): Metadata {
  const page = SEARCH_PAGES[path];
  return createPageMetadata(path, page.title, page.description);
}

const resultParameters: Partial<Record<SearchPagePath, readonly string[]>> = {
  "/corpus": ["query", "year", "cell_type", "organelle", "pair", "modality", "family", "metric", "comparator_class", "status", "public", "borderline", "sample_size_bucket"],
  "/analytics": ["query", "year", "cell_type", "organelle", "pair", "modality", "family", "metric", "comparator_class", "status", "public", "borderline", "sample_size_bucket", "row", "col"],
  "/plan": ["organelles", "res", "ss", "cell_type", "metric", "comparator_class", "family", "precedent_query", "precedent_public", "match", "resolution_factor", "sample_fraction", "scope"],
  "/compare": ["ids"]
};

function collectResultParameters(path: SearchPagePath, searchParams: RouteSearchParams): URLSearchParams {
  const normalized = normalizeSearchParams(searchParams);
  const parameters = new URLSearchParams();
  for (const key of resultParameters[path] ?? []) {
    const value = normalized[key]?.trim();
    if (!value || (["public", "borderline"].includes(key) && value !== "true" && value !== "1")) continue;
    parameters.set(key, value);
  }
  parameters.sort();
  return parameters;
}

export function isFilteredResultsUrl(url: URL): boolean {
  const path = url.pathname as SearchPagePath;
  if (!(path in resultParameters)) return false;
  return collectResultParameters(path, Object.fromEntries(url.searchParams)).size > 0;
}

export function createResultPageMetadata(path: SearchPagePath, searchParams: RouteSearchParams): Metadata {
  const parameters = collectResultParameters(path, searchParams);
  const page = SEARCH_PAGES[path];
  // View and tracking parameters do not create new canonical pages. Result
  // collections keep their own normalized URLs but are not search landing pages.
  return createPageMetadata(
    `${path}${parameters.size ? `?${parameters.toString()}` : ""}`,
    page.title,
    page.description,
    parameters.size === 0
  );
}
