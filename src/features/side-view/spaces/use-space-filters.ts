"use client";

import { useCallback, useSyncExternalStore } from "react";
import { historyStateWithoutNextKeys } from "@/features/map/group-size";
import { parseSpaceFilters, searchWithSpaceFilters, SPACE_FILTER_PARAM, type SpaceFilter } from "./space-filters";

const EVENT = "soothe-space-filters";
const EMPTY: SpaceFilter[] = [];

// useSyncExternalStore requires a stable snapshot. Cache the parsed list
// until the `f` value actually changes.
let cachedRaw: string | null | undefined;
let cachedFilters: SpaceFilter[] = EMPTY;

function readFilters(): SpaceFilter[] {
  const raw = new URLSearchParams(window.location.search).get(SPACE_FILTER_PARAM);
  if (raw === cachedRaw) return cachedFilters;
  cachedRaw = raw;
  cachedFilters = parseSpaceFilters(raw);
  return cachedFilters;
}

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function writeFilters(filters: readonly SpaceFilter[]) {
  const search = searchWithSpaceFilters(window.location.search, filters);
  const href = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (href !== current) {
    window.history.replaceState(historyStateWithoutNextKeys(window.history.state), "", href);
  }
  cachedRaw = new URLSearchParams(search).get(SPACE_FILTER_PARAM);
  cachedFilters = parseSpaceFilters(cachedRaw);
}

/** Chip state in `?f=quiet,printer`. Replacing the URL keeps Back on the previous screen. */
export function useSpaceFilters(): readonly [SpaceFilter[], (filters: readonly SpaceFilter[]) => void] {
  const filters = useSyncExternalStore(subscribe, readFilters, () => EMPTY);
  const setFilters = useCallback((next: readonly SpaceFilter[]) => {
    writeFilters(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [filters, setFilters];
}
