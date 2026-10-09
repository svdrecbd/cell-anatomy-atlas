import Link from "next/link";
import type { DatasetRecord } from "../lib/types";
import { publicationHref, publicDataHref, publicDataShortLabel, studyCitationLabel, voxelSizeLabel } from "../lib/display";
import { datasetHref } from "../lib/corpus-navigation";
import { CompareToggle } from "./compare-toggle";

type Props = { dataset: DatasetRecord; returnHref?: string };

export function DatasetCard({ dataset, returnHref = "/corpus" }: Props) {
  const paperHref = publicationHref(dataset);
  const dataHref = publicDataHref(dataset);
  return (
    <article className="bibliographic-record">
      <header className="bibliographic-record-header">
        <div><h3><Link prefetch={false} href={datasetHref(dataset.dataset_id, returnHref)}>{dataset.title}</Link></h3><p className="record-citation">{paperHref ? <a href={paperHref} target="_blank" rel="noopener noreferrer">{studyCitationLabel(dataset)}</a> : studyCitationLabel(dataset)}{dataset.publication_pmid ? ` · PMID ${dataset.publication_pmid}` : ""}</p></div>
        <CompareToggle id={dataset.dataset_id} returnHref={returnHref} />
      </header>
      <dl className="record-facts">
        <div><dt>Method</dt><dd>{dataset.modality}</dd></div><div><dt>Voxel size</dt><dd>{voxelSizeLabel(dataset)}</dd></div><div><dt>Cells</dt><dd>{dataset.sample_size ?? "Unknown"}</dd></div><div><dt>Public data</dt><dd>{publicDataShortLabel(dataset)}</dd></div>
      </dl>
      <p className="record-annotation"><span className="muted">Organelles:</span> {dataset.organelles.join(", ")}</p>
      {dataset.notes ? <p className="record-annotation"><span className="muted">Curation note:</span> {dataset.notes}</p> : null}
      <div className="record-source-links"><Link prefetch={false} href={datasetHref(dataset.dataset_id, returnHref)}>Record details</Link>{paperHref ? <a href={paperHref} target="_blank" rel="noopener noreferrer">Source publication</a> : null}{dataHref ? <a href={dataHref} target="_blank" rel="noopener noreferrer">Public repository</a> : null}<span className="muted">Metadata completeness: {Math.round(dataset.metadata_completeness_score * 100)}%</span>{dataset.included_status === "borderline" ? <span className="muted">Borderline record</span> : null}</div>
    </article>
  );
}
