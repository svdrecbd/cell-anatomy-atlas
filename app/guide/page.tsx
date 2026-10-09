import { SectionIndex } from "../../components/section-index";
import React from "react";
import Link from "next/link";
import { createSearchPageMetadata } from "../../lib/search-metadata";

export const metadata = createSearchPageMetadata("/guide");

const badges = [
  {
    label: "Res",
    className: "pill badge-verify",
    copy: "Three-dimensional voxel size is explicitly reported."
  },
  {
    label: "SS",
    className: "pill badge-verify",
    copy: "Sample size is explicitly reported."
  },
  {
    label: "Boundary",
    className: "pill badge-verify",
    copy: "Whole-cell boundary confirmation is present in the source record."
  },
  {
    label: "Public Data",
    className: "pill badge-public",
    copy: "A reusable public-data locator is known to exist."
  },
  {
    label: "Borderline",
    className: "pill badge-borderline",
    copy: "Useful near-miss record; keep it in context, but verify more carefully."
  }
];

export default function GuidePage() {
  return (
    <main className="reference-document">
      <section className="hero">
        <div className="kicker">Guide</div>
        <h1>Corpus Documentation</h1>
        <p>
          Use this page when you need the meaning of a score, badge, or status label. For general
          orientation, start from the landing page. For project context and source links, use
          About.
        </p>
      </section>

      <SectionIndex entries={[{ id: "comparability-score", label: "Overlap index" }, { id: "metadata-completeness", label: "Completeness" }, { id: "public-data-status", label: "Public data" }, { id: "inclusion-status", label: "Inclusion" }, { id: "badge-legend", label: "Badges" }, { id: "comparison-workflow", label: "Comparison workflow" }]} />

      <section className="panel"><h2 className="section-title">Precedent Search and Evidence Counts</h2><p>Precedent search requires all selected organelles by default. Choose any-target matching when alternatives are useful. Numeric requirements are exact by default; tolerances are explicit controls. Unknown values do not meet a specified numeric requirement.</p><p>Several matching precedents means at least three dataset records, and limited matching precedent means one or two. Source-study counts are shown separately because a publication can contribute multiple records. These labels describe the indexed literature.</p><p>Organelle–metric associations are record-level co-occurrences, rather than confirmed organelle-specific measurements. Normalized search categories retain original organelle wording in record details and JSON exports.</p></section>
      <section className="panel-grid two" style={{ marginTop: 32 }}>
        <section className="panel">
          <h2 id="comparability-score" className="section-title">Metadata Overlap Index</h2>
          <p className="muted" style={{ margin: "0 0 14px", lineHeight: 1.7 }}>
            This is a ranking aid for likely overlap, not a claim that two studies are equivalent.
            It rewards shared biology and shared technical structure, then compresses that into a
            quick reading. A high score means "look here first," not "pool these records without
            caveats." In practice, read it as a banded signal rather than a precise scientific
            measurement.
          </p>
          <RuleTable heading="Comparability score calculation" rules={[
            ["+25", "All selected records share the same cell type."],
            ["+10", "All selected records share the same species."],
            ["+5 per pair", "Shared metadata-derived organelle pairs; maximum 20 points."],
            ["+3 per family", "Shared metric families; maximum 15 points."],
            ["+10", "All selected records share the same modality family."],
            ["+10", "The selected records share a comparator class."],
            ["+10", "Every selected record has metadata completeness of at least 0.8."]
          ]} />
          <p className="field-description">The total is capped at 100. This index has no validated scientific thresholds. Use the biological and technical fields to assess a particular comparison.</p>
        </section>

        <section className="panel">
          <h2 id="metadata-completeness" className="section-title">Metadata Completeness</h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
            This measures how fully a record reports standardized fields such as modality,
            resolution, sample size, and curation status. It is not a scientific-quality score,
            and it should be read as a reporting-completeness aid rather than a merit ranking.
          </p>
          <RuleTable heading="Metadata completeness calculation" rules={[
            ["20%", "Identity fields are present in the seed record."],
            ["15%", "Biological context is present."],
            ["15% / 5%", "Resolution is reported / not reported."],
            ["20%", "Captured organelles are listed."],
            ["10%", "Metric families are listed."],
            ["10%", "Sample size is reported."],
            ["10% / 5%", "A public-data source is known / no source is known."]
          ]} />
        </section>
      </section>

      <section className="panel-grid two" style={{ marginTop: 32 }}>
        <section className="panel">
          <h2 id="public-data-status" className="section-title">Public Data Status</h2>
          <div style={{ display: "grid", gap: 12 }}>
            <p className="muted" style={{ margin: 0 }}>
              <strong>None</strong>: no reusable public data source is known from the current corpus
              materials.
            </p>
            <p className="muted" style={{ margin: 0 }}>
              <strong>Partial</strong>: some public underlying data or assets are available, but not
              necessarily the full dataset.
            </p>
            <p className="muted" style={{ margin: 0 }}>
              <strong>Complete</strong>: reusable public data is known to exist for the dataset in a
              stronger form.
            </p>
          </div>
        </section>

        <section className="panel">
          <h2 id="inclusion-status" className="section-title">Included vs Borderline</h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
            Included records met the primary corpus criteria. Borderline records are still useful,
            but they usually have a methodological, reporting, or whole-cell-coverage caveat that
            should remain visible.
          </p>
        </section>
      </section>

      <section className="panel" style={{ marginTop: 32 }}>
        <h2 id="badge-legend" className="section-title">Badge Legend</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {badges.map((badge) => (
            <div
              key={badge.label}
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr",
                gap: 12,
                alignItems: "center"
              }}
            >
              <span className={badge.className} style={{ textAlign: "center", width: "100%" }}>
                {badge.label}
              </span>
              <span className="muted" style={{ fontSize: "0.95rem" }}>
                {badge.copy}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel-grid two" style={{ marginTop: 32 }}>
        <section className="panel">
          <h2 id="comparison-workflow" className="section-title">Compare Workflow</h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
            Select two or more records in the corpus table or Records view. Open Compare records
            in the selection bar, or use Compare in the main navigation, to inspect their alignment.
            Your selection remains available as you move between pages.
          </p>
          <p className="muted" style={{ margin: "12px 0 0", lineHeight: 1.7 }}>
            Compare is dataset-level. Some papers contribute multiple records, so same-paper
            comparisons can be useful for checking conditions or modalities but should not be read
            as independent cross-study validation.
          </p>
        </section>

        <section className="panel">
          <h2 className="section-title">Best Next Step</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link prefetch={false} href="/corpus" className="button" style={{ textDecoration: "none" }}>
              Open the Corpus
            </Link>
            <Link prefetch={false} href="/about" className="button" style={{ textDecoration: "none" }}>
              Open About
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}

function RuleTable({ heading, rules }: { heading: string; rules: ReadonlyArray<readonly [string, string]> }) {
  return (
    <table className="reference-rule-table"><caption>{heading}</caption><thead><tr><th scope="col">Contribution</th><th scope="col">Condition</th></tr></thead><tbody>{rules.map(([contribution, condition], index) => <tr key={index}><td>{contribution}</td><td>{condition}</td></tr>)}</tbody></table>
  );
}
