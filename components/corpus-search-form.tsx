import Link from "next/link";
import { getCorpusFacets } from "../lib/corpus";
import { corpusHref } from "../lib/corpus-navigation";

type CorpusSearchFormProps = { parameters: Record<string, string | undefined>; action?: string };

export function CorpusSearchForm({ parameters, action = "/corpus" }: CorpusSearchFormProps) {
  const facets = getCorpusFacets();
  const additionalFields = ["cell_type", "modality", "metric", "year", "sample_size_bucket", "status", "comparator_class", "pair"];
  const renderSelect = (name: string, label: string, options: Array<{ value: string; label: string }>) => <div key={name}><label htmlFor={`scope-${name}`}>{label}</label><select id={`scope-${name}`} name={name} defaultValue={parameters[name] ?? ""} className="search-input"><option value="">Any</option>{parameters[name] && !options.some(option=>option.value===parameters[name]) ? <option value={parameters[name]}>{parameters[name]!.split(",").join(" + ")}</option> : null}{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
  return (
    <form action={action} method="get" className="corpus-search-form" aria-label="Corpus search">
      {["view", "row", "col", "rows", "chart"].map(name => parameters[name] ? <input key={name} type="hidden" name={name} value={parameters[name]} /> : null)}
      <div className="corpus-search-fields">
        <div className="corpus-query-field"><label htmlFor="corpus-query">Search records</label><input id="corpus-query" name="query" type="search" defaultValue={parameters.query ?? ""} placeholder="Cell type, species, study, or method" className="search-input" /></div>
        {renderSelect("organelle", "Organelle", facets.organelles.map(option => ({ value: option.value, label: option.value })))}
        {renderSelect("family", "Imaging family", [{value:"EM",label:"Electron microscopy"},{value:"X-ray",label:"X-ray microscopy"},{value:"optical",label:"Optical microscopy"}])}
      </div>
      <details className="document-disclosure search-additional-fields" open={additionalFields.some(name => Boolean(parameters[name])) || undefined}>
        <summary>More search filters</summary><div className="plan-criteria-grid">
          {renderSelect("cell_type", "Cell type", facets.cell_types.map(option => ({value:option.value,label:option.value})))}
          {renderSelect("modality", "Imaging method", facets.modalities.map(option => ({value:option.value,label:option.value})))}
          {renderSelect("metric", "Record-level metric", facets.metric_families.map(option => ({value:option.value,label:option.value.replaceAll("_", " ")})))}
          {renderSelect("sample_size_bucket", "Whole-cell count band", ["1","2-10","11-50","51+"].map(value=>({value,label:value})))}
          {renderSelect("status", "Public-data status", [{value:"complete",label:"Complete"},{value:"partial",label:"Partial"},{value:"none",label:"None indexed"}])}
          {renderSelect("comparator_class", "Comparator / condition", facets.comparator_classes.map(option=>({value:option.value,label:option.value})))}
          <div><label htmlFor="scope-year">Publication year</label><input id="scope-year" type="number" name="year" defaultValue={parameters.year ?? ""} className="search-input" placeholder="Any" /></div>
          {parameters.pair ? <div><label htmlFor="scope-pair">Derived organelle pair</label><input id="scope-pair" name="pair" defaultValue={parameters.pair} className="search-input" /></div> : null}
        </div>
      </details>
      <div className="corpus-search-actions"><div className="search-options"><label><input type="checkbox" name="public" value="true" defaultChecked={["true","1"].includes(parameters.public ?? "")} /> Public data only</label><label><input type="checkbox" name="borderline" value="true" defaultChecked={["true","1"].includes(parameters.borderline ?? "")} /> Include borderline records</label></div><div className="document-actions"><button type="submit" className="button">{action === "/analytics" ? "Update scope" : "Search corpus"}</button><Link prefetch={false} href={corpusHref({}, {}, action)}>Reset filters</Link></div></div>
    </form>
  );
}
