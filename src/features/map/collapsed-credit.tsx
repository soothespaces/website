"use client";

import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";

// MapLibre opens a compact credit the first time its text arrives, and only
// folds it after a drag. On phones that open box sits over pins and the
// selected plan (QA-078), so fold it once as soon as it turns compact. A tap
// on the "i" still opens it.
export function CollapsedCredit() {
  const map = useMap().current?.getMap();
  useEffect(() => {
    if (!map) return;
    const root = map.getContainer();
    let observer: MutationObserver | null = null;
    const fold = (credit: Element) => {
      if (!credit.classList.contains("maplibregl-compact")) return false;
      credit.classList.remove("maplibregl-compact-show");
      return true;
    };
    const frame = window.requestAnimationFrame(() => {
      const credit = root.querySelector(".maplibregl-ctrl-attrib");
      if (!credit || fold(credit)) return;
      observer = new MutationObserver(() => {
        if (fold(credit)) observer?.disconnect();
      });
      observer.observe(credit, {
        attributes: true,
        attributeFilter: ["class"],
      });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [map]);
  return null;
}
