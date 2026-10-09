"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { corpusReturnHref } from "./corpus-navigation";

type ComparisonSnapshot = { selectedIds: string[]; returnHref: string };
const initialSnapshot: ComparisonSnapshot = { selectedIds: [], returnHref: "/corpus" };
const ComparisonProviderContext = createContext(false);
const subscribers = new Set<() => void>();
let cachedSnapshot = initialSnapshot;
let cachedStorage: string | undefined;

function readComparisonSnapshot(): ComparisonSnapshot {
  if (typeof window === "undefined") return initialSnapshot;
  try {
    const storedIds = window.localStorage.getItem("scion_compare_ids");
    const storedOrigin = window.localStorage.getItem("cell_anatomy_comparison_origin");
    const storageIdentity = JSON.stringify([storedIds, storedOrigin]);
    if (storageIdentity !== cachedStorage) {
      let selectedIds: string[] = [];
      try {
        const values: unknown = JSON.parse(storedIds ?? "[]");
        if (Array.isArray(values) && values.every(value => typeof value === "string")) selectedIds = [...new Set(values)];
      } catch { /* Invalid saved selections are ignored. */ }
      cachedSnapshot = { selectedIds, returnHref: corpusReturnHref(storedOrigin) };
      cachedStorage = storageIdentity;
    }
  } catch { /* Keep the in-memory selection when browser storage is unavailable. */ }
  return cachedSnapshot;
}

function notifyComparisonSubscribers() {
  for (const subscriber of subscribers) subscriber();
}

function subscribeToComparison(callback: () => void) {
  subscribers.add(callback);
  if (subscribers.size === 1) window.addEventListener("storage", notifyComparisonSubscribers);
  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0) window.removeEventListener("storage", notifyComparisonSubscribers);
  };
}

function saveComparisonSnapshot(snapshot: ComparisonSnapshot) {
  cachedSnapshot = snapshot;
  try {
    if (snapshot.selectedIds.length) window.localStorage.setItem("scion_compare_ids", JSON.stringify(snapshot.selectedIds));
    else window.localStorage.removeItem("scion_compare_ids");
    window.localStorage.setItem("cell_anatomy_comparison_origin", snapshot.returnHref);
    cachedStorage = JSON.stringify([window.localStorage.getItem("scion_compare_ids"), snapshot.returnHref]);
  } catch { /* Keep the in-memory selection when browser storage is unavailable. */ }
  notifyComparisonSubscribers();
}

function toggleComparisonRecord(id: string, origin?: string) {
  const current = readComparisonSnapshot();
  saveComparisonSnapshot({
    selectedIds: current.selectedIds.includes(id) ? current.selectedIds.filter(value => value !== id) : [...current.selectedIds, id],
    returnHref: origin ? corpusReturnHref(origin) : current.returnHref
  });
}

function clearComparison() {
  saveComparisonSnapshot(initialSnapshot);
}

export function CompareProvider({ children }: { children: ReactNode }) {
  return <ComparisonProviderContext.Provider value={true}>{children}</ComparisonProviderContext.Provider>;
}

export function useCompare() {
  const hasProvider = useContext(ComparisonProviderContext);
  // Each consumer uses the same empty server snapshot during its own hydration.
  // Saved browser selections become visible only after that consumer hydrates.
  const snapshot = useSyncExternalStore(subscribeToComparison, readComparisonSnapshot, () => initialSnapshot);
  if (!hasProvider) throw new Error("useCompare must be used within a CompareProvider");
  return { ...snapshot, toggleId: toggleComparisonRecord, clear: clearComparison };
}
