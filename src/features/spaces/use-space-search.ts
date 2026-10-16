"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { searchSpaces } from "./search";
import type { SpaceSummary } from "./types";

// A search box's state and the spaces it matches. Typing stays responsive
// on long lists because filtering runs on a deferred copy of the query.
export type SpaceSearch = {
  query: string;
  setQuery: (query: string) => void;
  results: SpaceSummary[];
};

export function useSpaceSearch(spaces: SpaceSummary[], initialQuery = ""): SpaceSearch {
  const [query, setQuery] = useState(initialQuery);
  const deferred = useDeferredValue(query);
  const results = useMemo(() => searchSpaces(spaces, deferred), [spaces, deferred]);
  return { query, setQuery, results };
}
