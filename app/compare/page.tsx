import { corpusReturnHref, datasetHref } from "../../lib/corpus-navigation";
import Link from "next/link";
import { ApiFailurePanel } from "../../components/api-failure-panel";
import { getCompare } from "../../lib/api";
import { CompareSummary } from "../../components/compare-summary";
import { publicationHref, publicDataHref, publicDataShortLabel, studyCitationLabel, voxelSizeLabel } from "../../lib/display";
import { normalizeSearchParams, type RouteSearchParams } from "../../lib/route-props";

import { createResultPageMetadata } from "../../lib/search-metadata";

export async function generateMetadata({ searchParams }: { searchParams: Promise<RouteSearchParams> }) {
  return createResultPageMetadata("/compare", await searchParams);
}

export default async function ComparePage({
  searchParams
}: {
  searchParams: Promise<RouteSearchParams>;
}) {
  const resolvedSearchParams = normalizeSearchParams(await searchParams);
  const returnHref = corpusReturnHref(resolvedSearchParams.return_to);
  const ids = resolvedSearchParams.ids?.split(",").filter(Boolean) || [];

  if (ids.length < 2) {
    return (
      <main className="comparison-document">
        <div style={{ marginBottom: 24 }}>
          <Link prefetch={false} href={returnHref} className="muted" style={{ textDecoration: "underline" }}>
            ← Back to corpus
          </Link>
        </div>
        <section className="hero">
          <h1>Compare Records</h1>
          <p>
            Select two or more records in the corpus table or Records view. This page aligns their
            reported biological and technical fields, with source citations and interpretation guidance.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
            <Link prefetch={false} href="/corpus" className="button" style={{ textDecoration: "none" }}>
              Open corpus
            </Link>
            <Link prefetch={false} href="/guide" className="button" style={{ textDecoration: "none" }}>
              Compare guide
            </Link>
          </div>
        </section>
      </main>
    );
  }

  let payload;

  try {
    payload = await getCompare(ids);
  } catch (error) {
    return (
      <main className="comparison-document">
        <div style={{ marginBottom: 24 }}>
          <Link prefetch={false} href={returnHref} className="muted" style={{ textDecoration: "underline" }}>
            ← Back to corpus
          </Link>
        </div>

        <section className="hero">
          <div className="kicker">Compare View</div>
          <h1>Compare Mode is temporarily degraded.</h1>
          <p>
            The selected dataset set could not be aligned right now.
          </p>
        </section>

        <ApiFailurePanel
          error={error}
          context="the compare view"
          page="compare"
          actionHref="/corpus"
          actionLabel="Back to corpus selection"
        />
      </main>
    );
  }

  return (
    <main className="comparison-document">
      <div style={{ marginBottom: 24 }}>
        <Link prefetch={false} href={returnHref} className="muted" style={{ textDecoration: "underline" }}>
          ← Back to corpus
        </Link>
      </div>

      <section className="hero">
        <div className="kicker">Compare View</div>
        <h1>Dataset-level alignment for {payload.datasets.length} records.</h1>
        <p>Inspect shared biological traits, reported technical fields, and the sources behind each selected record.</p>
      </section>

      <details className="document-disclosure comparison-guidance">
        <summary>How to interpret this comparison</summary>
        <p>Each column is a dataset record. A study may contribute several records for different cell types, conditions, or methods. Follow the source citations before treating this as independent cross-study evidence.</p>
      </details>

      <div style={{ marginTop: 32 }}>
        <CompareSummary payload={payload} />
      </div>

      <p className="table-scroll-instruction">Scroll horizontally to inspect all selected records.</p>
      <div className="compare-matrix-wrapper" tabIndex={0} role="region" aria-label="Selected dataset comparison table">
        <table className="compare-matrix comparison-record-table">
          <caption>Reported biological and technical fields for the selected records</caption>
          <thead>
            <tr>
              <th>Feature</th>
              {payload.datasets.map((d) => {
                const paperHref = publicationHref(d);

                return (
                  <th key={d.dataset_id}>
                    <Link prefetch={false} href={datasetHref(d.dataset_id, returnHref)} style={{ textDecoration: "underline" }}>
                      {d.title}
                    </Link>
                    <div className="muted" style={{ fontSize: "0.8rem", marginTop: 4 }}>
                      {paperHref ? (
                        <a
                          href={paperHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "inherit", textDecoration: "underline" }}
                        >
                          {studyCitationLabel(d)}
                        </a>
                      ) : (
                        studyCitationLabel(d)
                      )}
                      {d.publication_pmid ? ` · PMID ${d.publication_pmid}` : ""}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Cell Type</th>
              {payload.datasets.map((d) => (
                <td key={d.dataset_id}>{d.cell_type}</td>
              ))}
            </tr>
            <tr>
              <th>Species</th>
              {payload.datasets.map((d) => (
                <td key={d.dataset_id}><em>{d.species}</em></td>
              ))}
            </tr>
            <tr>
              <th>Modality</th>
              {payload.datasets.map((d) => (
                <td key={d.dataset_id}>{d.modality}</td>
              ))}
            </tr>
            <tr>
              <th>Voxel Size (XY/Z nm)</th>
              {payload.datasets.map((d) => (
                <td key={d.dataset_id}>{voxelSizeLabel(d)}</td>
              ))}
            </tr>
            <tr><th>Whole-cell count</th>{payload.datasets.map(record => <td key={record.dataset_id}>{record.sample_size ?? "Unreported"}</td>)}</tr>
            <tr><th>Comparator / condition</th>{payload.datasets.map(record => <td key={record.dataset_id}>{record.comparator_detail ?? record.comparator_class ?? "Unreported"}</td>)}</tr>
            <tr><th>Whole-cell boundary</th>{payload.datasets.map(record => <td key={record.dataset_id}>{record.whole_cell_boundary_confirmed}</td>)}</tr>
            <tr><th>Unreported technical fields</th>{payload.datasets.map(record => <td key={record.dataset_id}>{[record.lateral_resolution_nm == null ? "XY voxel size" : null, record.axial_resolution_nm == null ? "Z voxel size" : null, record.sample_size == null ? "Whole-cell count" : null].filter(Boolean).join(", ") || "None of these fields"}</td>)}</tr>
            <tr>
              <th>Organelles</th>
              {payload.datasets.map((d) => (
                <td key={d.dataset_id}>
                  <div className="pill-row">
                    {d.organelles.map((o) => (
                      <span key={o} className={`pill ${payload.shared_fields.organelles.includes(o) ? "match-highlight" : ""}`}>
                        {o}
                      </span>
                    ))}
                  </div>
                </td>
              ))}
            </tr>
            <tr>
              <th>Metrics</th>
              {payload.datasets.map((d) => (
                <td key={d.dataset_id}>
                  <div className="pill-row">
                    {d.metric_families.map((m) => (
                      <span key={m} className={`pill ${payload.shared_fields.metric_families.includes(m) ? "match-highlight" : ""}`}>
                        {m}
                      </span>
                    ))}
                  </div>
                </td>
              ))}
            </tr>
            <tr>
              <th>Data Publicly Available</th>
              {payload.datasets.map((d) => {
                const dataHref = publicDataHref(d);
                const label = publicDataShortLabel(d);

                return (
                  <td key={d.dataset_id}>
                    {dataHref ? (
                      <a
                        href={dataHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "inherit", textDecoration: "underline" }}
                      >
                        {label}
                      </a>
                    ) : (
                      label
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  );
}
