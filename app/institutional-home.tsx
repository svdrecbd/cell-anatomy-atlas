import Link from "next/link";
import { redirect } from "next/navigation";
import { normalizeSearchParams, type RouteSearchParams } from "../lib/route-props";
import corpusRecords from "../lib/corpus-data.json";

const resourceSections = [
  { title: "The Corpus", href: "/corpus" },
  { title: "Compare Datasets", href: "/compare" },
  { title: "Analytics", href: "/analytics" },
  { title: "Experiment Planning", href: "/plan" },
  { title: "About Cell Anatomy", href: "/about" },
  { title: "Documentation", href: "/guide" }
];

export default async function LandingPage({ searchParams }: { searchParams: Promise<RouteSearchParams> }) {
  const resolvedSearchParams = normalizeSearchParams(await searchParams);
  const parameters = new URLSearchParams();
  Object.entries(resolvedSearchParams).forEach(([key, value]) => { if (value) parameters.set(key, value); });
  if (parameters.size > 0) redirect(`/corpus?${parameters.toString()}`);
  const publicRecordCount = corpusRecords.filter(record => record.public_data_status !== "none").length;
  const publicationYears = corpusRecords.map(record => record.year);

  return (
    <main className="institutional-portal">
      <header className="portal-masthead">
        <Link prefetch={false} href="/" className="portal-identity" aria-label="Cell Anatomy home">
          <h1 className="portal-title">Cell Anatomy</h1>
        </Link>
        <span className="portal-descriptor">Whole-Cell Imaging Dataset Atlas</span>
      </header>
      <div className="portal-resource-grid">
        <figure className="portal-geometric-illustration">
          <img src="/illustrations/perspective-construction.svg" alt="Circular sections and rectangular frames converging toward a perspective vanishing point" width="800" height="620" />
        </figure>
        <nav className="portal-resource-navigation" aria-label="Scientific resources">
          {resourceSections.map(section => (
            <Link prefetch={false} href={section.href} key={section.href}>
              <span className="portal-resource-title">{section.title}</span>
            </Link>
          ))}
        </nav>
      </div>
      <div className="portal-corpus-summary" aria-label="Corpus summary">
        <span>{corpusRecords.length} dataset records</span>
        <span>{Math.min(...publicationYears)}–{Math.max(...publicationYears)}</span>
        <span>{publicRecordCount} records with public data locators</span>
      </div>
    </main>
  );
}
