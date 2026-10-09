import { corpusFilterKeys } from "../lib/corpus-navigation";

type Props = { rowDim: string; colDim: string; parameters: Record<string, string | undefined> };

export function AnalyticsControls({ rowDim, colDim, parameters }: Props) {
  return <form action="/analytics#coverage" method="get" className="analytics-exploration-controls">
    {[...corpusFilterKeys, "chart"].map(name => parameters[name] ? <input key={name} type="hidden" name={name} value={parameters[name]} /> : null)}
    <div><label htmlFor="analytics-row">Compare</label><select id="analytics-row" name="row" defaultValue={rowDim} className="search-input"><option value="organelle">Organelles</option><option value="cell_type">Cell types</option><option value="modality">Imaging methods</option><option value="comparator_class">Comparators / conditions</option></select></div>
    <div><label htmlFor="analytics-column">By</label><select id="analytics-column" name="col" defaultValue={colDim} className="search-input"><option value="modality_family">Imaging family</option><option value="public_data_status">Public-data status</option><option value="sample_size_bucket">Whole-cell count band</option></select></div>
    <div><label htmlFor="analytics-rows">Rows shown</label><select id="analytics-rows" name="rows" defaultValue={parameters.rows ?? "20"} className="search-input"><option value="20">20 most represented categories</option><option value="all">All categories</option></select></div>
    <button type="submit" className="button">Update coverage</button>
  </form>;
}
