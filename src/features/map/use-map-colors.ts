"use client";

import { useMemo, useSyncExternalStore } from "react";

// Design tokens the map's own layers paint with. MapLibre paints on a canvas
// and can't read CSS variables, so their current values are read from the
// page and re-read whenever the theme, contrast or palette changes.
const TOKENS = ["primary", "primary-foreground", "card", "foreground", "muted-foreground"] as const;
export type MapColors = Record<(typeof TOKENS)[number], string>;

const QUERIES = ["(prefers-color-scheme: dark)", "(prefers-contrast: more)"];

function subscribe(onChange: () => void) {
  const media = QUERIES.map((query) => window.matchMedia(query));
  for (const m of media) m.addEventListener("change", onChange);
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "data-contrast", "data-palette"],
  });
  return () => {
    for (const m of media) m.removeEventListener("change", onChange);
    observer.disconnect();
  };
}

// One string, so the snapshot only changes when a value does.
function getSnapshot() {
  const style = getComputedStyle(document.documentElement);
  return TOKENS.map((token) => style.getPropertyValue(`--${token}`).trim()).join("|");
}

export function useMapColors(): MapColors {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => "");
  return useMemo(() => {
    const values = snapshot.split("|");
    return Object.fromEntries(TOKENS.map((token, i) => [token, values[i] || "#000000"])) as MapColors;
  }, [snapshot]);
}
