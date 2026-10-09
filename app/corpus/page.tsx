import Link from "next/link";
import { permanentRedirect } from "next/navigation";
import { ApiFailurePanel } from "../../components/api-failure-panel";
import { BadgeLegend } from "../../components/badge-legend";
import { CompareToggle } from "../../components/compare-toggle";
import { DatasetCard } from "../../components/dataset-card";
import { FacetBar } from "../../components/facet-bar";
import { CorpusSearchForm } from "../../components/corpus-search-form";
import { getCompare, getDatasets, pickExampleCompareIds } from "../../lib/api";
import { CompareSummary } from "../../components/compare-summary";
import { ResultSummary } from "../../components/result-summary";
import { publicationHref, publicDataHref, publicDataShortLabel, studyCitationLabel, voxelSizeLabel } from "../../lib/display";
import { normalizeSearchParams, type RouteSearchParams } from "../../lib/route-props";
import { createResultPageMetadata } from "../../lib/search-metadata";
import { correctLegacyCorpusParameters } from "../../lib/corpus-parameters";
import { corpusHref, datasetHref } from "../../lib/corpus-navigation";
import type { CompareResponse, SearchResponse } from "../../lib/types";

export async function generateMetadata({ searchParams }: { searchParams: Promise<RouteSearchParams> }) {
  return createResultPageMetadata("/corpus", await searchParams);
}

const filterLabels: Record<string, string> = { query: "Search", year: "Year", cell_type: "Cell type", organelle: "Organelle", modality: "Method", family: "Family", pair: "Organelle pair", metric: "Metric", comparator_class: "Comparator", status: "Public-data status", public: "Public data only", borderline: "Borderline records", sample_size_bucket: "Whole-cell count band" };

export default async function CorpusPage({ searchParams }: { searchParams: Promise<RouteSearchParams> }) {
  const parameters = normalizeSearchParams(await searchParams);
  const legacyParameters = new URLSearchParams();
  for (const [key, value] of Object.entries(parameters)) {
    if (value) legacyParameters.set(key, value);
  }
  const corrected = correctLegacyCorpusParameters(legacyParameters);
  if (corrected) permanentRedirect(`/corpus?${corrected.toString()}`);
  let response: SearchResponse;
  try { response = await getDatasets(parameters); }
  catch (error) { return <main><section className="hero"><div className="kicker">Corpus</div><h1>The Whole-Cell Imaging Corpus</h1></section><ApiFailurePanel error={error} context="corpus search" page="corpus" actionHref="/corpus" actionLabel="Return to corpus" /></main>; }
  const isTable = parameters.view !== "cards";
  const activeFilters = Object.entries(parameters).filter(([key, value]) => value && key in filterLabels && (!(key === "public" || key === "borderline") || value === "true"));
  const filterUrl = (changes: Record<string, string | null>, base = "/corpus") => corpusHref(parameters, changes, base);
  const returnHref = filterUrl({});
  const planParameters = new URLSearchParams({ return_to: returnHref, scope: returnHref, edit: "true" });
  for (const name of ["cell_type", "metric", "comparator_class", "family"]) if (parameters[name]) planParameters.set(name, parameters[name]!);
  if (parameters.organelle) planParameters.set("organelles", parameters.organelle);
  else if (parameters.pair) planParameters.set("organelles", parameters.pair.split(":").join(","));
  const studyCount = new Set(response.results.map(record => record.source_study_id ?? record.dataset_id)).size;
  let exampleComparison: CompareResponse | null = null;
  const exampleIds = pickExampleCompareIds(response);
  if (exampleIds.length >= 2) { try { exampleComparison = await getCompare(exampleIds); } catch { /* Optional example does not block the record index. */ } }
  return (
    <main className="corpus-document">
      <section className="hero"><div className="kicker">Research records</div><h1>The Whole-Cell Imaging Corpus</h1><p>Search whole-cell imaging studies, inspect their technical metadata, and select records for comparison.</p></section>
      <CorpusSearchForm parameters={parameters} />
      {activeFilters.length ? <div className="active-filter-list" aria-label="Active filters">{activeFilters.map(([key, value]) => <Link prefetch={false} key={key} href={filterUrl({ [key]: null })} aria-label={`Remove ${filterLabels[key]} filter`}>{filterLabels[key]}{key === "public" || key === "borderline" ? "" : `: ${value}`} ×</Link>)}</div> : null}
      <div className="corpus-results-header">
        <h2>{response.total} {response.total === 1 ? "record" : "records"}{parameters.query ? ` for “${parameters.query}”` : ""}</h2>
        <div className="record-tools">
          <nav className="record-view-navigation" aria-label="Record presentation"><Link prefetch={false} href={filterUrl({ view: "table" })} aria-current={isTable ? "page" : undefined}>Table</Link><Link prefetch={false} href={filterUrl({ view: "cards" })} aria-current={!isTable ? "page" : undefined}>Records</Link></nav>
          <div className="export-links"><span>Export</span>{[["csv", "CSV"], ["json", "JSON"], ["bibtex", "BibTeX"]].map(([format, label]) => <a key={format} href={filterUrl({ format }, "/api/datasets/export")} download>{label}</a>)}</div>
        </div>
      </div>
      <div className="document-actions corpus-workflow-actions"><span className="muted">{studyCount} source studies · corpus years 2004–2024</span><Link prefetch={false} href={filterUrl({}, "/analytics")}>Explore these results</Link><Link prefetch={false} href={`/plan?${planParameters.toString()}`}>Find experimental precedent</Link></div>
      {response.total === 0 ? <section className="empty-records"><h3>No matching records</h3><p>Broaden the search or remove a filter to inspect a larger part of the corpus.</p><Link prefetch={false} href="/corpus">Return to all records</Link></section> : isTable ? (
        <>
          <p className="table-scroll-instruction">The table scrolls horizontally when all fields do not fit. Select two or more records to compare.</p>
          <div className="record-table-scroll" tabIndex={0} role="region" aria-label="Whole-cell imaging records table">
            <table className="records-table"><caption>Whole-cell imaging records and reported technical metadata</caption><thead><tr><th scope="col">Compare</th><th scope="col">Record and citation</th><th scope="col">Cell type</th><th scope="col">Method</th><th scope="col">Voxel size (XY/Z)</th><th scope="col">Cells</th><th scope="col">Public data</th></tr></thead><tbody>
              {response.results.map(record => {
                const paperHref = publicationHref(record); const dataHref = publicDataHref(record);
                return <tr key={record.dataset_id}>
                  <td><CompareToggle id={record.dataset_id} compact returnHref={returnHref} /></td>
                  <td><Link prefetch={false} href={datasetHref(record.dataset_id, returnHref)} className="record-title">{record.title}</Link><span className="record-citation">{paperHref ? <a href={paperHref} target="_blank" rel="noopener noreferrer">{studyCitationLabel(record)}</a> : studyCitationLabel(record)}{record.publication_pmid ? ` · PMID ${record.publication_pmid}` : ""}</span></td>
                  <td>{record.cell_type}<span className="record-species"><em>{record.species}</em></span></td><td>{record.modality}</td><td>{voxelSizeLabel(record)}</td><td>{record.sample_size ?? "Unknown"}</td><td>{dataHref ? <a href={dataHref} target="_blank" rel="noopener noreferrer">{publicDataShortLabel(record)}</a> : "None indexed"}</td>
                </tr>;
              })}
            </tbody></table>
          </div>
        </>
      ) : <div className="dataset-grid record-bibliography">{response.results.map(record => <DatasetCard key={record.dataset_id} dataset={record} returnHref={returnHref} />)}</div>}
      <details className="document-disclosure corpus-disclosure"><summary>Common traits in these results</summary><ResultSummary response={response} searchParams={parameters} /><FacetBar title="Frequent traits" description="These are frequencies within the selected records, rather than quality rankings." items={[
        ...response.commonalities.top_organelles.slice(0, 3).map(value => ({ label: value, href: filterUrl({ organelle: value }) })),
        ...response.commonalities.top_modalities.slice(0, 3).map(value => ({ label: value, href: filterUrl({ modality: value }) }))
      ]} /></details>
      <details className="document-disclosure"><summary>How to interpret records and badges</summary><p>Public-data status identifies known repository locators; it does not mean the atlas mirrors those images. Completeness describes metadata reporting. Open the source publication before using a record as evidence.</p><BadgeLegend title="Record badges" compact /><Link prefetch={false} href="/guide">Read the corpus documentation</Link></details>
      {exampleComparison ? <details className="document-disclosure"><summary>Example comparison from this result set</summary><CompareSummary payload={exampleComparison} preview /></details> : null}
    </main>
  );
}
