const organelleAliases: Record<string, string> = {
  mito: "mitochondria",
  "lipid droplet": "lipid droplets",
  flagella: "flagella/cilia",
  vacuole: "vacuole/lysosome",
  axomene: "axoneme",
  "dense granules)": "dense granules",
  "other: secretory organelles (microneme": "secretory organelles (microneme)"
};

export function normalizeOrganelle(value: string) {
  const normalized = value.trim().toLowerCase();
  return organelleAliases[normalized] ?? normalized;
}
