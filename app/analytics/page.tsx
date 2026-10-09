import Link from "next/link";
import { SectionIndex } from "../../components/section-index";
import { CorpusSearchForm } from "../../components/corpus-search-form";
import { AnalyticsControls } from "../../components/analytics-controls";
import { FrontierPlot } from "../../components/frontier-plot";
import { filterDatasets, crossTab, frontier, benchmarks, corpusTimeline, measurementGrammar, reusabilityMap } from "../../lib/corpus";
import { corpusHref, intersectCorpusHref } from "../../lib/corpus-navigation";
import { normalizeSearchParams, type RouteSearchParams } from "../../lib/route-props";
import { createResultPageMetadata } from "../../lib/search-metadata";

export async function generateMetadata({searchParams}: {searchParams: Promise<RouteSearchParams>}) {
  return createResultPageMetadata("/analytics", await searchParams);
}

function categoryLabel(value: string) {
  return ({EM:"Electron microscopy", "X-ray":"X-ray microscopy", optical:"Optical microscopy", complete:"Complete", partial:"Partial", none:"None indexed", er:"Endoplasmic reticulum"} as Record<string,string>)[value] ?? value.replaceAll("_", " ");
}

export default async function AnalyticsPage({searchParams}: {searchParams: Promise<RouteSearchParams>}) {
  const parameters = normalizeSearchParams(await searchParams);
  const records = filterDatasets(parameters);
  const points = frontier(parameters);
  const timeline = corpusTimeline(parameters);
  const statistics = benchmarks(parameters);
  const publicData = reusabilityMap(parameters);
  const associations = measurementGrammar(parameters);
  const row = ["organelle","cell_type","modality","comparator_class"].includes(parameters.row ?? "") ? parameters.row! : "organelle";
  const column = ["modality_family","public_data_status","sample_size_bucket"].includes(parameters.col ?? "") ? parameters.col! : "modality_family";
  const coverage = crossTab(row, column, parameters);
  const coverageRows = coverage.rows.sort((left,right) => coverage.row_totals[right] - coverage.row_totals[left] || left.localeCompare(right));
  const visibleRows = parameters.rows === "all" ? coverageRows : coverageRows.slice(0,20);
  const columns = column === "sample_size_bucket" ? ["1","2-10","11-50","51+","Unreported"].filter(value=>coverage.cols.includes(value)) : coverage.cols;
  const maximum = Math.max(1,...Object.values(coverage.table).flatMap(values=>Object.values(values)));
  const studyCount = new Set(records.map(record=>record.source_study_id ?? record.dataset_id)).size;
  const knownPublic = records.filter(record=>record.public_data_status !== "none").length;
  const dimensionKey = column === "modality_family" ? "family" : column === "public_data_status" ? "status" : column;
  const cellHref = (rowValue: string, columnValue: string) => intersectCorpusHref(parameters, { [row]: rowValue, [dimensionKey]:columnValue });
  const scopeHref = corpusHref(parameters);
  return <main className="analytics-document">
    <section className="hero"><div className="kicker">Corpus exploration</div><h1>Explore the Evidence</h1><p>Inspect published technical precedent, find available data, and browse coverage within the indexed corpus.</p></section>
    <CorpusSearchForm parameters={parameters} action="/analytics" />
    <div className="evidence-scope"><strong>{records.length} {records.length === 1 ? "record" : "records"} · {studyCount} source {studyCount === 1 ? "study" : "studies"}</strong><span>{knownPublic} records with public-data locators · source corpus 2004–2024</span><Link prefetch={false} href={scopeHref}>Open these records in the corpus</Link></div>
    <SectionIndex entries={[{id:"technical-precedent",label:"Technical precedent"},{id:"public-data",label:"Available data"},{id:"coverage",label:"Coverage explorer"},{id:"metric-associations",label:"Metric associations"}]} />
    {records.length === 0 ? <section className="empty-records"><h2>No records in this scope</h2><p>Remove a filter or broaden the search to inspect published precedent.</p><Link prefetch={false} href="/analytics">Explore the full corpus</Link></section> : <>
      <section className="figure-plate"><div className="figure-plate-header"><div><h2 id="technical-precedent" className="section-title">Technical Precedent</h2><p className="muted">Reported lateral voxel size and whole-cell count for individual records.</p></div></div>
        <FrontierPlot data={points} timeline={timeline} parameters={parameters} totalRecords={records.length} returnHref={scopeHref} />
        <details className="document-disclosure"><summary>Descriptive statistics by imaging family</summary><p className="muted">Each variable is summarized separately. These ranges are observations in this scope, rather than demonstrated combinations or instrument limits.</p><div className="analytics-table-wrap"><table className="analytics-matrix"><thead><tr><th>Family</th><th>Records</th><th>XY median / range (nm)</th><th>Whole-cell median / range</th></tr></thead><tbody>{statistics.map(family=><tr key={family.modality_family}><th><Link prefetch={false} href={corpusHref(parameters,{family:family.modality_family})}>{categoryLabel(family.modality_family)}</Link></th><td>{family.count}</td><td>{family.resolution_stats ? `${family.resolution_stats.median} / ${family.resolution_stats.min}–${family.resolution_stats.max} (n=${family.resolution_stats.count})` : "Unreported"}</td><td>{family.sample_size_stats ? `${family.sample_size_stats.median} / ${family.sample_size_stats.min}–${family.sample_size_stats.max} (n=${family.sample_size_stats.count})` : "Unreported"}</td></tr>)}</tbody></table></div></details>
      </section>
      <section className="figure-plate"><div className="figure-plate-header"><div><h2 id="public-data" className="section-title">Available Public Data</h2><p className="muted">Known repository locators for each organelle category. Access status does not establish suitability for a particular reuse.</p></div><Link prefetch={false} href={corpusHref(parameters,{public:"true",status:null})}>Find available records</Link></div>
        <div className="analytics-table-wrap"><table className="analytics-matrix"><thead><tr><th>Organelle</th><th>Complete</th><th>Partial</th><th>None indexed</th><th>Records with locators</th></tr></thead><tbody>{publicData.organelles.map(organelle=><tr key={organelle}><th>{categoryLabel(organelle)}</th>{publicData.statuses.map(status=><td key={status}>{publicData.matrix[organelle][status] > 0 ? <Link prefetch={false} href={intersectCorpusHref(parameters,{organelle,status,public:null})}>{publicData.matrix[organelle][status]}</Link> : "0"}</td>)}<td><Link prefetch={false} href={intersectCorpusHref(parameters,{organelle,public:"true",status:null})}>{publicData.reusable_totals[organelle] ?? 0} / {publicData.row_totals[organelle]}</Link></td></tr>)}</tbody></table></div>
      </section>
      <section className="figure-plate"><div className="figure-plate-header"><div><h2 id="coverage" className="section-title">Coverage Explorer</h2><p className="muted">Choose the categories to compare. Select a populated count to open the corresponding corpus records.</p></div></div>
        <AnalyticsControls rowDim={row} colDim={column} parameters={parameters} />
        <p className="field-description">Showing {visibleRows.length} of {coverageRows.length} categories. Zero means no matching indexed records. Organelles can occur together, so their row totals are not additive.</p>
        <div className="analytics-table-wrap" tabIndex={0} role="region" aria-label="Coverage counts"><table className="analytics-matrix analytics-gap-matrix"><thead><tr><th>{categoryLabel(row)}</th>{columns.map(value=><th key={value}>{categoryLabel(value)}</th>)}<th>Total</th></tr></thead><tbody>{visibleRows.map(value=><tr key={value}><th>{categoryLabel(value)}</th>{columns.map(category=>{const count=coverage.table[value]?.[category] ?? 0; return <td key={category} style={{background:count ? `rgba(36,76,105,${0.06+count/maximum*0.24})` : "transparent"}}>{count > 0 ? <Link prefetch={false} href={cellHref(value,category)} aria-label={`${count} ${count === 1 ? "record" : "records"}: ${categoryLabel(value)}, ${categoryLabel(category)}`}>{count}</Link> : <span aria-label="No matching indexed records">0</span>}</td>;})}<td>{coverage.row_totals[value]}</td></tr>)}</tbody></table></div>
      </section>
      <details id="metric-associations" className="document-disclosure"><summary>Record-Level Metric Associations</summary><p>An association means a record lists both the organelle and the metric category. It does not establish that the metric was measured for that particular organelle. Each record contributes once to an organelle total.</p><div className="analytics-table-wrap"><table className="analytics-matrix"><thead><tr><th>Organelle</th>{associations.metric_families.map(metric=><th key={metric}>{categoryLabel(metric)}</th>)}<th>Distinct records</th></tr></thead><tbody>{associations.organelles.map(organelle=><tr key={organelle}><th>{categoryLabel(organelle)}</th>{associations.metric_families.map(metric=><td key={metric}>{associations.matrix[organelle]?.[metric] ? <Link prefetch={false} href={intersectCorpusHref(parameters,{organelle,metric})}>{associations.matrix[organelle][metric]}</Link> : "0"}</td>)}<td>{associations.organelle_totals[organelle]}</td></tr>)}</tbody></table></div></details>
    </>}
  </main>;
}
