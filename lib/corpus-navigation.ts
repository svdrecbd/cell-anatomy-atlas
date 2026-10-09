export const corpusFilterKeys = ["query", "year", "cell_type", "organelle", "pair", "modality", "family", "metric", "comparator_class", "status", "public", "borderline", "sample_size_bucket"];

export function corpusHref(parameters: Record<string, string | undefined>, changes: Record<string, string | null> = {}, path = "/corpus") {
  const values = new URLSearchParams();
  for (const key of [...corpusFilterKeys, "view"]) if (parameters[key]) values.set(key, parameters[key]!);
  for (const [key, value] of Object.entries(changes)) value === null ? values.delete(key) : values.set(key, value);
  return `${path}${values.size ? `?${values.toString()}` : ""}`;
}

export function corpusReturnHref(value?: string | null): string {
  if (!value || !(value === "/corpus" || value.startsWith("/corpus?"))) return "/corpus";
  const values = Object.fromEntries(new URLSearchParams(value.split("?")[1] ?? ""));
  return corpusHref(values);
}

export function datasetHref(id: string, returnHref: string) {
  return `/datasets/${encodeURIComponent(id)}?return_to=${encodeURIComponent(corpusReturnHref(returnHref))}`;
}

export function intersectCorpusHref(parameters: Record<string, string | undefined>, changes: Record<string, string | null>) {
  const combined = { ...changes };
  for (const key of ["organelle", "metric"]) {
    if (parameters[key] && combined[key]) combined[key] = [...new Set([...parameters[key]!.split(","), ...combined[key]!.split(",")])].join(",");
  }
  return corpusHref(parameters, combined);
}
