import records from "./corpus-data.json";

const modalityFamilies = new Set(records.map(record => record.modality_family.toLowerCase()));
const imagingModalities = new Map(records.map(record => [record.modality.toLowerCase(), record.modality]));

/** Correct links previously generated with a specific method in the family field. */
export function correctLegacyCorpusParameters(parameters: URLSearchParams): URLSearchParams | null {
  const family = parameters.get("family")?.trim().toLowerCase();
  if (!family || modalityFamilies.has(family)) return null;
  const modality = imagingModalities.get(family);
  if (!modality) return null;

  const corrected = new URLSearchParams(parameters);
  corrected.delete("family");
  if (!corrected.get("modality")) corrected.set("modality", modality);
  return corrected;
}
