"use client";

import { useCompare } from "../lib/compare-context";

export function CompareToggle({ id, compact = false, returnHref }: { id: string; compact?: boolean; returnHref?: string }) {
  const { selectedIds, toggleId } = useCompare();
  const isSelected = selectedIds.includes(id);
  const label = compact
    ? isSelected
      ? "Selected"
      : "Select"
    : isSelected
      ? "Remove from comparison"
      : "Select for comparison";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleId(id, returnHref);
      }}
      className={`compare-toggle-btn ${compact ? "compare-toggle-compact" : ""} ${isSelected ? "selected" : ""}`}
      aria-pressed={isSelected}
      aria-label={isSelected ? "Remove dataset from compare set" : "Add dataset to compare set"}
    >
      {label}
    </button>
  );
}
