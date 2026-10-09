import Link from "next/link";
import type { CompareResponse } from "../lib/types";

type Props = { payload: CompareResponse; preview?: boolean };
const fieldLabels: Record<string, string> = {
  cell_types: "Cell type", species: "Species", organelles: "Organelles", organelle_pairs: "Derived organelle pairs", metric_families: "Metric families", comparator_classes: "Comparator / condition", modality_families: "Modality family", modalities: "Modality", sample_size_buckets: "Sample-size band", public_data_statuses: "Public-data status", boundary_confirmation: "Boundary confirmation"
};

export function CompareSummary({ payload, preview = false }: Props) {
  const studyCounts = payload.datasets.reduce<Record<string, number>>((counts, dataset) => {
    const identity = dataset.source_study_id || dataset.dataset_id;
    counts[identity] = (counts[identity] ?? 0) + 1;
    return counts;
  }, {});
  const repeatedStudies = Object.entries(studyCounts).filter(([, count]) => count > 1).map(([identity]) => identity);
  return (
    <section className="comparison-summary" aria-label="Comparison summary">
      <div className="comparison-overview">
        <div><h2>{preview ? "Example comparison" : "Biological overlap"}</h2><p>{payload.summary}</p></div>

      </div>
      {repeatedStudies.length > 0 ? <p className="interpretation-note">These records include the same study ({repeatedStudies.join(", ")}). Read this as within-study alignment, not independent cross-study validation.</p> : null}
      <details className="document-disclosure">
        <summary>Shared traits and technical differences</summary>
        <div className="comparison-findings">
          <section><h3>Shared traits</h3><dl>{Object.entries(payload.shared_fields).map(([field, values]) => <div key={field}><dt>{fieldLabels[field] ?? field}</dt><dd>{field === "organelle_pairs" && values.length > 3 ? <details><summary>{values.length} metadata-derived pairs</summary>{values.join(", ")}</details> : values.length ? values.join(", ") : "None shared"}</dd></div>)}</dl></section>
          <section><h3>Technical differences</h3><dl>{Object.entries(payload.key_differences).map(([field, values]) => <div key={field}><dt>{fieldLabels[field] ?? field}</dt><dd>{values.join(", ")}</dd></div>)}</dl></section>
        </div>
      </details>
      <details className="document-disclosure"><summary>Metadata overlap index: {payload.comparability_score} / 100</summary><p>This heuristic summarizes shared metadata. It does not establish measurement equivalence or experimental validity.</p><Link prefetch={false} href="/guide#comparability-score">Calculation and limitations</Link></details>
    </section>
  );
}
