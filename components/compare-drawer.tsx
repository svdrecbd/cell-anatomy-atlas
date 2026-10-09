"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCompare } from "../lib/compare-context";

export function CompareDrawer() {
  const { selectedIds, clear, returnHref } = useCompare();
  const pathname = usePathname();
  if (selectedIds.length === 0 || pathname === "/compare" || pathname === "/") return null;
  return (
    <aside className="compare-drawer" aria-label="Comparison selection">
      <div className="compare-drawer-content">
        <div><strong>{selectedIds.length}</strong> {selectedIds.length === 1 ? "record" : "records"} selected</div>
        <div className="compare-drawer-actions">
          <button type="button" onClick={clear} className="text-button">Clear selection</button>
          {selectedIds.length >= 2 ? <Link prefetch={false} href={`/compare?ids=${selectedIds.join(",")}&return_to=${encodeURIComponent(returnHref)}`} className="button">Compare records</Link> : <span className="selection-guidance">Select another record to compare</span>}
        </div>
      </div>
    </aside>
  );
}
