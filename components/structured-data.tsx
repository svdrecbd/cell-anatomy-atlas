import { serializeStructuredData } from "../lib/structured-data";

export function StructuredData({ identifier, value }: { identifier: string; value: unknown }) {
  return <script id={identifier} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(value) }} />;
}
