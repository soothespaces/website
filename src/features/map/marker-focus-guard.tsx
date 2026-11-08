"use client";

import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";

const FOCUSABLE = ".maplibregl-marker button, .maplibregl-marker a[href], .maplibregl-marker [tabindex]";
const MARK = "data-offscreen-marker";

// Pins are DOM buttons the map places by its transform, so a pin far off
// screen, or under the phone sheet, still took a Tab stop and its focus ring
// was nowhere to be seen (QA-007). After each move, pins that aren't on the
// visible part of the map leave the tab order; they come back when they are.
// Screen readers still list them.
export function MarkerFocusGuard() {
  const map = useMap().current?.getMap();

  useEffect(() => {
    if (!map) return;
    const container = map.getContainer();

    function update() {
      const view = container.getBoundingClientRect();
      // The phone sheet sits over the bottom of the map in the same column.
      const sheet = container.closest("[data-map-column]")?.querySelector<HTMLElement>("[data-map-sheet]");
      const sheetTop = sheet ? sheet.getBoundingClientRect().top : Infinity;
      const bottom = Math.min(view.bottom, sheetTop);
      for (const el of container.querySelectorAll<HTMLElement>(FOCUSABLE)) {
        const box = el.getBoundingClientRect();
        const visible =
          box.right > view.left && box.left < view.right && box.bottom > view.top && box.top < bottom;
        if (!visible && !el.hasAttribute(MARK)) {
          if (el.getAttribute("tabindex") === "-1") continue;
          el.setAttribute(MARK, el.getAttribute("tabindex") ?? "");
          el.tabIndex = -1;
        } else if (visible && el.hasAttribute(MARK)) {
          const original = el.getAttribute(MARK);
          el.removeAttribute(MARK);
          if (original) el.setAttribute("tabindex", original);
          else el.removeAttribute("tabindex");
        }
      }
    }

    update();
    map.on("moveend", update);
    map.on("idle", update);
    map.on("resize", update);
    return () => {
      map.off("moveend", update);
      map.off("idle", update);
      map.off("resize", update);
    };
  }, [map]);

  return null;
}
