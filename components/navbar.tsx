"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCompare } from "../lib/compare-context";

const navigationEntries = [
  { path: "/corpus", label: "Corpus" },
  { path: "/compare", label: "Compare" },
  { path: "/analytics", label: "Analytics" },
  { path: "/plan", label: "Plan" },
  { path: "/about", label: "About" },
  { path: "/guide", label: "Documentation" }
];

export function Navbar() {
  const pathname = usePathname();
  const { selectedIds, returnHref } = useCompare();
  if (pathname === "/") return null;
  return (
    <header className="navbar-container">
      <div className="navbar">
        <Link prefetch={false} href="/" className="institutional-brand" aria-label="Cell Anatomy home">
          <span className="institutional-identity"><span>Cell Anatomy</span><small>A resource for whole-cell imaging</small></span>
        </Link>
        <nav className="nav-links" aria-label="Main navigation">
          {navigationEntries.map(entry => (
            <Link prefetch={false}
              key={entry.path}
              href={entry.path === "/compare" && selectedIds.length ? `/compare?ids=${selectedIds.join(",")}&return_to=${encodeURIComponent(returnHref)}` : entry.path}
              aria-current={pathname === entry.path || (entry.path === "/corpus" && pathname.startsWith("/datasets/")) ? "page" : undefined}
            >
              {entry.label}{entry.path === "/compare" && selectedIds.length > 0 ? <span className="navigation-count">{selectedIds.length}</span> : null}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
