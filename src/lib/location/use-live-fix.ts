"use client";

import { useEffect, useSyncExternalStore } from "react";
import { acquireSampler, ensureStarted, getServerSnapshot, getSnapshot, subscribe, type LocationFix } from "./store";

/**
 * A fresh fix while this component is mounted. Reads start only after
 * permission is granted and the visitor has interacted with the page, and
 * they pause while the tab is hidden.
 */
export function useLiveFix(): LocationFix | null {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    void ensureStarted();
    return acquireSampler();
  }, []);

  if (snap.permission !== "granted") return null;
  return snap.fix;
}
