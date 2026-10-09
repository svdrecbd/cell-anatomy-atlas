import { normalizeOrganelle } from "../../lib/organelle-terminology";
import { corpusReturnHref, datasetHref } from "../../lib/corpus-navigation";
import React from "react";
import Link from "next/link";
import { ApiFailurePanel } from "../../components/api-failure-panel";
import { CopyTextButton } from "../../components/copy-text-button";
import { DegradedStatusBanner } from "../../components/degraded-status-banner";
import { getExperimentPlan, getFacets } from "../../lib/api";
import { publicDataHref, publicDataShortLabel, publicationHref, studyCitationLabel, voxelSizeLabel } from "../../lib/display";
import { normalizeSearchParams, type RouteSearchParams } from "../../lib/route-props";
import type { DatasetRecord, FacetResponse, PlanAnalysis } from "../../lib/types";
import { createResultPageMetadata } from "../../lib/search-metadata";

const modalityFamilies = ["EM", "X-ray", "optical", "other"];
const organelleDisplayNames: Record<string, string> = {
  er: "endoplasmic reticulum"
};

function formatOrganelleLabel(value: string) {
  return organelleDisplayNames[value.toLowerCase()] ?? value;
}

function scopeDescription(value: string) {
  const labels: Record<string,string> = { query:"Search", year:"Year", cell_type:"Cell type", organelle:"Organelle", pair:"Organelle pair", modality:"Method", family:"Imaging family", metric:"Record-level metric", comparator_class:"Comparator", status:"Public-data status", sample_size_bucket:"Cell-count band", public:"Public data", borderline:"Borderline records" };
  return [...new URLSearchParams(corpusReturnHref(value).split("?")[1] ?? "")].filter(([key])=>key in labels).map(([key,entry])=>`${labels[key]}: ${entry}`).join(" · ") || "Full corpus";
}

function formatOrganelleTarget(value: string) {
  return value.split(" & ").map(formatOrganelleLabel).join(" & ");
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<RouteSearchParams> }) {
  return createResultPageMetadata("/plan", await searchParams);
}

export default async function PlanPage({
  searchParams
}: {
  searchParams: Promise<RouteSearchParams>;
}) {
  const resolvedSearchParams = normalizeSearchParams(await searchParams);
  const selectedOrganelles = splitParam(resolvedSearchParams.organelles).map(normalizeOrganelle);
  const isPlanning = selectedOrganelles.length > 0 && resolvedSearchParams.edit !== "true";

  const returnHref = corpusReturnHref(resolvedSearchParams.return_to);
  const planParams = {
    organelles: selectedOrganelles.join(","),
    res: resolvedSearchParams.res,
    ss: resolvedSearchParams.ss,
    cell_type: resolvedSearchParams.cell_type,
    metric: resolvedSearchParams.metric,
    comparator_class: resolvedSearchParams.comparator_class,
    family: resolvedSearchParams.family,
    match: resolvedSearchParams.match ?? "all",
    resolution_factor: resolvedSearchParams.resolution_factor ?? "1",
    sample_fraction: resolvedSearchParams.sample_fraction ?? "1",
    return_to: returnHref,
    scope: resolvedSearchParams.scope
  };

  let analysis: PlanAnalysis | null = null;
  let analysisError: unknown = null;
  if (isPlanning) {
    try {
      analysis = await getExperimentPlan(planParams);
    } catch (error) {
      analysisError = error;
    }
  }

  let facets: FacetResponse | null = null;
  let corpusLookupError: unknown = null;

  try {
    facets = await getFacets();
  } catch (error) {
    corpusLookupError = error;
  }

  const degradedIssues = [
    analysisError
      ? {
          label: "Experiment analysis",
          context: "the experiment plan analysis",
          error: analysisError
        }
      : null,
    corpusLookupError
      ? {
          label: "Planner criteria",
          context: isPlanning ? "planner criteria labels" : "planner criteria options",
          error: corpusLookupError
        }
      : null
  ].filter(Boolean) as Array<{ label: string; context: string; error: unknown }>;

  const precedentQuery = resolvedSearchParams.precedent_query || "";
  const precedentPublic = resolvedSearchParams.precedent_public || "";
  const precedentSort = resolvedSearchParams.precedent_sort || "year_desc";
  const displayedPrecedents = analysis
    ? sortPrecedents(
        filterPrecedents(
          filterPrecedentsByPublicData(analysis.precedents, precedentPublic),
          precedentQuery
        ),
        precedentSort
      )
    : [];
  const pmids = unique(displayedPrecedents.map((record) => record.publication_pmid).filter(Boolean) as string[]);
  const pmidList = pmids.join("\n");
  const planExportHref = `/api/datasets/analytics/plan/export${buildQueryString({
    ...planParams,
    precedent_query: precedentQuery,
    precedent_public: precedentPublic,
    precedent_sort: precedentSort
  })}`;
  const pubmedHref = pmids.length > 0
    ? `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(pmids.join(","))}`
    : null;

  const editableParameters = new URLSearchParams();
  Object.entries(planParams).forEach(([name, value]) => { if (value != null && value !== "") editableParameters.set(name, String(value)); });
  editableParameters.set("edit", "true");

  return (
    <main className="planner-document">
      <div className="document-actions"><Link prefetch={false} href={returnHref}>← Back to corpus results</Link></div>
      <section className="hero">
        <div className="kicker">Planner</div>
        <h1>Find Experimental Precedent</h1>
        <p>
          Find published records that match your biological targets and technical requirements. Counts describe evidence in this corpus.
        </p>
      </section>

      {degradedIssues.length > 0 ? (
        <DegradedStatusBanner
          page="plan"
          title="Planner Degraded"
          issues={degradedIssues}
        />
      ) : null}

      {resolvedSearchParams.scope ? <div className="evidence-scope"><span>Literature scope: {scopeDescription(resolvedSearchParams.scope)}</span><Link prefetch={false} href={(() => { const values = new URLSearchParams(editableParameters); values.delete("scope"); return `/plan?${values}`; })()}>Remove corpus scope</Link></div> : null}
      {!isPlanning ? (
        <section className="panel planner-form-section">
          {corpusLookupError ? (
            <div style={{ marginBottom: 20 }}>
              <ApiFailurePanel
                error={corpusLookupError}
                context="planner criteria options"
                page="plan"
                title="Corpus-backed criteria unavailable"
                compact
              />
            </div>
          ) : null}
          {selectedOrganelles.length === 0 && resolvedSearchParams.match && resolvedSearchParams.edit !== "true" ? <p role="alert">Select at least one biological target to find matching precedent.</p> : null}
          <PlanForm
            facets={facets}
            selectedOrganelles={selectedOrganelles}
            resolvedSearchParams={resolvedSearchParams}
          />

          <details className="document-disclosure" style={{ marginTop: 24 }}>
            <summary>Benchmarking rules and interpretation</summary>
            <div className="muted" style={{ display: "grid", gap: 8, lineHeight: 1.6 }}>
              <div><strong>Match rule</strong>: choose records containing all selected organelles or any selected organelle.</div>
              <div><strong>XY voxel size</strong>: blank means any; otherwise records must meet the requested lateral voxel size, with an optional tolerance.</div>
              <div><strong>Statistical Scope</strong>: blank means any; otherwise records must meet the requested whole-cell count, with an optional fraction.</div>
              <div><strong>Precedent counts</strong>: several means three or more matching records; limited means one or two. Multiple records can come from the same study.</div>
              <div><strong>Unreported fields</strong>: records without the required numeric field do not pass that requirement.</div>
            </div>
          </details>
        </section>
      ) : (
        <div className="planner-results-container">
          <div style={{ marginBottom: 24 }}>
            <Link prefetch={false} href={`/plan?${editableParameters.toString()}`} className="muted" style={{ textDecoration: "underline" }}>
              Edit Plan
            </Link>
          </div>

          {analysis ? (
            <div className="planner-results">
              <div className="summary-grid">
                <section className="panel planner-report" style={{ borderLeft: `3px solid ${getStatusColor(analysis.status)}` }}>
                  <div className="kicker" style={{ color: getStatusColor(analysis.status) }}>{precedentStatusLabel(analysis.status)}</div>
                  <h2 className="section-title">Matching Precedent</h2>
                  <p style={{ fontSize: "1.1rem", lineHeight: 1.6 }}>{analysis.status_message}</p>
                  <p className="muted" style={{ margin: "12px 0 0", lineHeight: 1.6 }}>
                    {analysis.matched_records_count} target records from {analysis.matched_studies_count} source studies.{" "}
                    {analysis.threshold_records_count} {analysis.threshold_records_count === 1 ? "record" : "records"} from {analysis.threshold_studies_count} source {analysis.threshold_studies_count === 1 ? "study" : "studies"} passed the active requirements.
                  </p>
                  <p className="field-description">Target rule: {planParams.match === "any" ? "any selected organelle" : "all selected organelles"}. Maximum lateral voxel size: {planParams.res ? `${Number(planParams.res) * Number(planParams.resolution_factor)} nm` : "any"}. Minimum whole-cell count: {planParams.ss ? Math.ceil(Number(planParams.ss) * Number(planParams.sample_fraction)) : "any"}.</p>
                </section>

                <section className="panel">
                  <h2 className="section-title">Active Criteria</h2>
                  <div className="pill-row">
                    {selectedOrganelles.map((organelle) => (
                      <span key={organelle} className="pill">{formatOrganelleLabel(organelle)}</span>
                    ))}
                    <span className="pill">XY voxel size: {resolvedSearchParams.res ? `${resolvedSearchParams.res} nm` : "Any"}</span>
                    <span className="pill">Whole-Cell Count: {resolvedSearchParams.ss || "Any"}</span>
                    {resolvedSearchParams.cell_type ? <span className="pill">Cell Type: {resolvedSearchParams.cell_type}</span> : null}
                    {resolvedSearchParams.metric ? <span className="pill">Metric: {resolvedSearchParams.metric}</span> : null}
                    {resolvedSearchParams.comparator_class ? <span className="pill">Comparator: {resolvedSearchParams.comparator_class}</span> : null}
                    {resolvedSearchParams.family ? <span className="pill">Family: {resolvedSearchParams.family}</span> : null}
                  </div>
                </section>

                <section className="panel">
                  <h2 className="section-title">Methods in Matching Records</h2>
                  <p>{analysis.modality_recommendation}</p>
                </section>

                <section className="panel">
                  <h2 className="section-title">Record-Level Metric Associations</h2>
                  <p className="muted">Across records containing the selected biological targets for <strong>{formatOrganelleTarget(analysis.biological_target)}</strong>, these metric families appear most often at record level. Their presence does not establish a measurement for each selected organelle:</p>
                  <div className="pill-row" style={{ marginTop: 12 }}>
                    {analysis.standard_metrics.length > 0 ? (
                      analysis.standard_metrics.map((metric: string) => (
                        <span key={metric} className="pill">{metric}</span>
                      ))
                    ) : (
                      <span className="muted">No metric families found for this criteria set.</span>
                    )}
                  </div>
                </section>

                <section className="panel precedent-section">
                  <div className="precedent-header">
                    <div>
                      <h2 className="section-title">Precedent records</h2>
                      <p className="muted" style={{ margin: 0 }}>
                        {displayedPrecedents.length} of {analysis.precedents.length} record-level precedents shown.
                      </p>
                    </div>
                    <a href={planExportHref} className="button" style={{ textDecoration: "none" }} download>
                      Download Visible CSV
                    </a>
                  </div>

                  <form action="/plan" className="precedent-controls">
                    <HiddenPlanInputs params={planParams} />
                    <label className="visually-hidden" htmlFor="precedent-query">Filter precedent records</label>
                    <input
                      id="precedent-query"
                      type="search"
                      name="precedent_query"
                      defaultValue={precedentQuery}
                      className="search-input"
                      placeholder="Filter visible records..."
                    />
                    <select aria-label="Precedent public-data status" name="precedent_public" defaultValue={precedentPublic} className="search-input">
                      <option value="">Any public-data state</option>
                      <option value="complete">Complete public data</option>
                      <option value="partial">Partial public data</option>
                      <option value="none">No indexed public data</option>
                    </select>
                    <select aria-label="Precedent sort order" name="precedent_sort" defaultValue={precedentSort} className="search-input">
                      <option value="year_desc">Newest First</option>
                      <option value="year_asc">Oldest First</option>
                      <option value="author_asc">First Author A-Z</option>
                      <option value="sample_desc">Largest Sample</option>
                      <option value="res_asc">Finest Resolution</option>
                      <option value="public_first">Public Data First</option>
                    </select>
                    <button type="submit" className="button">Update Table</button>
                  </form>

                  <PrecedentTable records={displayedPrecedents} returnHref={returnHref} />
                  {analysis.related_precedents.length > 0 ? <details className="document-disclosure"><summary>{analysis.related_precedents.length} target records outside the technical requirements</summary><p>These records contain the biological targets but fail a numeric requirement or lack a required field. They are separate from matching precedent.</p><PrecedentTable records={analysis.related_precedents} returnHref={returnHref} /></details> : null}
                </section>
              </div>

              <aside style={{ display: "grid", gap: 16 }}>
                <section className="panel">
                  <h2 className="section-title">PMID List</h2>
                  {pmids.length > 0 ? (
                    <>
                      <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
                        Unique PMIDs from the currently displayed precedent rows.
                      </p>
                      <textarea
                        readOnly
                        value={pmidList}
                        className="search-input"
                        style={{ width: "100%", minHeight: 96, resize: "vertical", fontFamily: "monospace" }}
                      />
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
                        <CopyTextButton text={pmidList} label="Copy PMID List" />
                        {pubmedHref ? (
                          <a href={pubmedHref} target="_blank" rel="noopener noreferrer" className="button" style={{ textDecoration: "none" }}>
                            Open PubMed Search
                          </a>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <p className="muted">No PMIDs are available for this precedent set.</p>
                  )}
                </section>

                <section className="panel">
                  <h2 className="section-title">Matching Public Data</h2>
                  <p className="muted">These matching records have known public-data locators:</p>
                  <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                    {analysis.suggested_baselines.length > 0 ? (
                      analysis.suggested_baselines.map((record: DatasetRecord) => (
                        <Link prefetch={false} key={record.dataset_id} href={datasetHref(record.dataset_id, returnHref)} style={{ textDecoration: "none", display: "block", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                          <div className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase" }}>
                            {studyCitationLabel(record)}
                            {record.publication_pmid ? ` · PMID ${record.publication_pmid}` : ""}
                            {" · "}
                            {record.cell_type}
                          </div>
                          <div style={{ fontWeight: 500, fontSize: "0.95rem" }}>{record.title}</div>
                          <div className="pill pill-link" style={{ marginTop: 8, textAlign: "center", fontSize: "0.8rem" }}>
                            Open Record
                          </div>
                        </Link>
                      ))
                    ) : (
                      <span className="muted">No records with public-data locators meet the active requirements.</span>
                    )}
                  </div>
                </section>
              </aside>
            </div>
          ) : (
            <ApiFailurePanel
              error={analysisError}
              context="the experiment plan analysis"
              page="plan"
              title="Experiment analysis unavailable"
            />
          )}
        </div>
      )}
    </main>
  );
}

function PlanForm({ facets, selectedOrganelles, resolvedSearchParams }: {
  facets: FacetResponse | null; selectedOrganelles: string[]; resolvedSearchParams: Record<string, string | undefined>;
}) {
  const commonOptions = facets?.organelles.slice(0, 8) ?? [];
  const additionalOptions = facets?.organelles.slice(8) ?? [];
  const renderOption = (option: { value: string; count: number }) => (
    <label key={option.value} className="choice-option">
      <input type="checkbox" name="organelles" value={option.value} defaultChecked={selectedOrganelles.includes(option.value)} />
      <span>{formatOrganelleLabel(option.value)}</span><span className="choice-count" aria-hidden="true">{option.count}</span>
    </label>
  );
  return (
    <form action="/plan" method="get" className="experiment-plan-form">
      {resolvedSearchParams.scope ? <input type="hidden" name="scope" value={corpusReturnHref(resolvedSearchParams.scope)} /> : null}
      <input type="hidden" name="return_to" value={corpusReturnHref(resolvedSearchParams.return_to)} />
      <fieldset className="plan-targets">
        <legend>1. Biological targets</legend>
        <p className="field-description">Choose one or more organelles. Select whether a record must contain all targets or any target.</p>
        <div className="plan-match-rule"><label htmlFor="plan-match">Target match rule</label><select id="plan-match" name="match" defaultValue={resolvedSearchParams.match ?? "all"} className="search-input"><option value="all">All selected organelles</option><option value="any">Any selected organelle</option></select></div>
        {facets ? <>
          <div className="choice-grid">{commonOptions.map(renderOption)}</div>
          <details className="document-disclosure additional-targets" open={additionalOptions.some(option => selectedOrganelles.includes(option.value)) || undefined}>
            <summary>Other organelle targets ({additionalOptions.length})</summary><div className="choice-grid">{additionalOptions.map(renderOption)}</div>
          </details>
        </> : <><label htmlFor="plan-organelles">Organelle names, separated by commas</label><input id="plan-organelles" type="text" name="organelles" defaultValue={resolvedSearchParams.organelles ?? ""} className="search-input" placeholder="nucleus,mitochondria" /></>}
      </fieldset>
      <fieldset>
        <legend>2. Technical requirements</legend>
        <div className="plan-criteria-grid">
          <div><label htmlFor="plan-resolution">Lateral voxel size (nm)</label><input id="plan-resolution" type="number" step="any" min="0.000001" name="res" defaultValue={resolvedSearchParams.res ?? ""} className="search-input" placeholder="Any" /><p className="field-description">Blank means any voxel size. Unreported values cannot meet a specified requirement.</p></div>
          <div><label htmlFor="plan-sample-size">Whole-cell count</label><input id="plan-sample-size" type="number" min="1" name="ss" defaultValue={resolvedSearchParams.ss ?? ""} className="search-input" placeholder="Any" /><p className="field-description">Counts are per record and are not pooled across studies. Blank means any count.</p></div>
          <div><label htmlFor="plan-resolution-factor">Voxel-size tolerance</label><select id="plan-resolution-factor" name="resolution_factor" defaultValue={resolvedSearchParams.resolution_factor ?? "1"} className="search-input"><option value="1">Exact requirement (1×)</option><option value="1.25">Allow 1.25×</option><option value="1.5">Allow 1.5×</option><option value="2">Allow 2×</option></select></div>
          <div><label htmlFor="plan-sample-fraction">Minimum fraction of requested cell count</label><select id="plan-sample-fraction" name="sample_fraction" defaultValue={resolvedSearchParams.sample_fraction ?? "1"} className="search-input"><option value="1">Full requested count (100%)</option><option value="0.75">75% of requested count</option><option value="0.5">50% of requested count</option></select></div>
        </div>
      </fieldset>
      <fieldset>
        <legend>3. Biological and methodological context</legend>
        <div className="plan-criteria-grid">
          <div><label htmlFor="plan-cell-type">Cell type</label><select id="plan-cell-type" name="cell_type" defaultValue={resolvedSearchParams.cell_type ?? ""} className="search-input"><option value="">Any cell type</option>{facets?.cell_types.map(option => <option key={option.value} value={option.value}>{option.value} ({option.count})</option>)}</select></div>
          <div><label htmlFor="plan-comparator">Comparator / condition</label><select id="plan-comparator" name="comparator_class" defaultValue={resolvedSearchParams.comparator_class ?? ""} className="search-input"><option value="">Any comparator</option>{facets?.comparator_classes.map(option => <option key={option.value} value={option.value}>{option.value} ({option.count})</option>)}</select></div>
          <div><label htmlFor="plan-metric">Record-level metric</label><select id="plan-metric" name="metric" defaultValue={resolvedSearchParams.metric ?? ""} className="search-input"><option value="">Any metric</option>{facets?.metric_families.map(option => <option key={option.value} value={option.value}>{option.value} ({option.count})</option>)}</select></div>
          <div><label htmlFor="plan-family">Modality family</label><select id="plan-family" name="family" defaultValue={resolvedSearchParams.family ?? ""} className="search-input"><option value="">Any family</option>{modalityFamilies.map(family => <option key={family} value={family}>{family}</option>)}</select></div>
        </div>
      </fieldset>
      <div className="document-actions"><button type="submit" className="button">Find Matching Precedent</button><Link prefetch={false} href={`/plan?return_to=${encodeURIComponent(corpusReturnHref(resolvedSearchParams.return_to))}`}>Clear criteria</Link></div>
    </form>
  );
}

function HiddenPlanInputs({ params }: { params: Record<string, string | number | null | undefined> }) {
  return (
    <>
      {Object.entries(params).map(([key, value]) => (
        value ? <input key={key} type="hidden" name={key} value={String(value)} /> : null
      ))}
    </>
  );
}

function PrecedentTable({ records, returnHref }: { records: DatasetRecord[]; returnHref: string }) {
  if (records.length === 0) {
    return <p className="muted">No records match the current table filter.</p>;
  }

  return (
    <>
    <p className="table-scroll-instruction">Scroll horizontally to inspect all precedent fields.</p>
    <div className="analytics-table-wrap" tabIndex={0} role="region" aria-label="Experiment precedent records">
      <table className="analytics-matrix plan-precedent-table">
        <thead>
          <tr>
            <th>Record</th>
            <th>PMID</th>
            <th>Cell Type</th>
            <th>Modality</th>
            <th>Voxel Size</th>
            <th>Whole-Cell Count</th>
            <th>Metrics</th>
            <th>Data Publicly Available</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const paperHref = publicationHref(record);
            const dataHref = publicDataHref(record);
            const publicLabel = publicDataShortLabel(record);

            return (
              <tr key={record.dataset_id}>
                <td>
                  <Link prefetch={false} href={datasetHref(record.dataset_id, returnHref)} style={{ textDecoration: "underline", fontWeight: 500 }}>
                    {record.title}
                  </Link>
                  <div className="muted" style={{ fontSize: "0.8rem" }}>
                    {paperHref ? (
                      <a
                        href={paperHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "inherit", textDecoration: "underline" }}
                      >
                        {studyCitationLabel(record)}
                      </a>
                    ) : (
                      studyCitationLabel(record)
                    )}
                    {record.publication_pmid ? ` · PMID ${record.publication_pmid}` : ""}
                  </div>
                </td>
                <td>
                  {record.publication_pmid ? (
                    <a
                      href={`https://pubmed.ncbi.nlm.nih.gov/${record.publication_pmid}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ textDecoration: "underline" }}
                    >
                      {record.publication_pmid}
                    </a>
                  ) : (
                    <span className="muted">None</span>
                  )}
                </td>
                <td>
                  <div>{record.cell_type}</div>
                  <div className="muted" style={{ fontSize: "0.85rem" }}>
                    <em>{record.species}</em>
                  </div>
                </td>
                <td>{record.modality}</td>
                <td>{voxelSizeLabel(record)}</td>
                <td>{record.sample_size ?? "Unknown"}</td>
                <td>{record.metric_families.slice(0, 4).join(", ") || "None"}</td>
                <td>
                  {dataHref ? (
                    <a
                      href={dataHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "inherit", textDecoration: "underline" }}
                    >
                      {publicLabel}
                    </a>
                  ) : (
                    publicLabel
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}

function splitParam(value?: string) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildQueryString(params: Record<string, string | number | null | undefined>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

function filterPrecedents(records: DatasetRecord[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return records;

  return records.filter((record) => {
    const haystack = [
      record.dataset_id,
      record.source_study_id || "",
      record.publication_pmid || "",
      record.paper_title,
      record.source,
      record.cell_type,
      record.species,
      record.modality,
      record.comparator_class || "",
      record.comparator_detail || "",
      record.organelles.join(" "),
      record.metric_families.join(" ")
    ].join(" ").toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

function filterPrecedentsByPublicData(records: DatasetRecord[], publicState: string) {
  if (!publicState) return records;
  return records.filter((record) => record.public_data_status === publicState);
}

function sortPrecedents(records: DatasetRecord[], sortKey: string) {
  const sorted = [...records];
  sorted.sort((left, right) => {
    switch (sortKey) {
      case "year_asc":
        return left.year - right.year || left.dataset_id.localeCompare(right.dataset_id);
      case "author_asc":
        return (
          precedentAuthorKey(left).localeCompare(precedentAuthorKey(right)) ||
          right.year - left.year ||
          left.dataset_id.localeCompare(right.dataset_id)
        );
      case "sample_desc":
        return (right.sample_size ?? -1) - (left.sample_size ?? -1) || right.year - left.year;
      case "res_asc":
        return (left.lateral_resolution_nm ?? Number.POSITIVE_INFINITY) - (right.lateral_resolution_nm ?? Number.POSITIVE_INFINITY) || right.year - left.year;
      case "public_first":
        return publicRank(right.public_data_status) - publicRank(left.public_data_status) || right.year - left.year;
      case "year_desc":
      default:
        return right.year - left.year || left.dataset_id.localeCompare(right.dataset_id);
    }
  });
  return sorted;
}

function precedentAuthorKey(record: DatasetRecord) {
  const author = (record.source_study_id || "")
    .replace(/\b(19|20)\d{2}\b/g, "")
    .replace(/\bet\s+al\.?/i, "")
    .replace(/[,\s]+$/g, "")
    .trim()
    .split(/\s+/)[0];

  return (author || record.dataset_id).toLowerCase();
}

function publicRank(status: DatasetRecord["public_data_status"]) {
  if (status === "complete") return 2;
  if (status === "partial") return 1;
  return 0;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function precedentStatusLabel(status: string) {
  const labels: Record<string, string> = { several: "Several matching precedents", limited: "Limited matching precedent", no_threshold_matches: "No records meet the requirements", no_target_matches: "No indexed target records" };
  return labels[status] ?? status;
}

function getStatusColor(status: string) {
  return status === "several" ? "#244c69" : status === "limited" ? "#7d251d" : "#56504a";
}
