"use client";

import { useSyncExternalStore } from "react";

// Whether a media query matches, kept up to date. False on the server and
// during hydration, so render both layouts with CSS (md:hidden, hidden
// md:flex) where a first paint matters, and use this for behavior.
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
