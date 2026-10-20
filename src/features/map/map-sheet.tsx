"use client";

import { useState } from "react";
import { useMediaQuery } from "@/lib/use-media-query";
import { WIDE_QUERY } from "./map-layout-config";
import { useMapState } from "./map-state";
import { SelectionPanel } from "./panel/selection-panel";
import { useSwipeToDismiss } from "./use-swipe-to-dismiss";
import { Button } from "@/components/ui/button";

// Phones: what's selected, in a sheet over the bottom of the map so the
// place stays in view. The handle (or a swipe up) expands it to the full
// height; a swipe down collapses it, then closes it.
export function MapSheet() {
  const wide = useMediaQuery(WIDE_QUERY);
  const { route, clear } = useMapState();
  const [expanded, setExpanded] = useState(false);
  // Your spots opens tall. A collapsed peek puts Sign in under the map controls.
  // Remember a manual collapse only until the next time the screen is opened.
  const [spotsCollapsed, setSpotsCollapsed] = useState(false);
  const [trackedKind, setTrackedKind] = useState(route.kind);
  if (route.kind !== trackedKind) {
    setTrackedKind(route.kind);
    if (route.kind === "my-spots") setSpotsCollapsed(false);
  }
  const sheetExpanded = route.kind === "my-spots" ? !spotsCollapsed : expanded;
  const setSheetExpanded = (next: boolean) => {
    if (route.kind === "my-spots") setSpotsCollapsed(!next);
    else setExpanded(next);
  };
  const { drag, handlers } = useSwipeToDismiss({
    directions: sheetExpanded ? ["down"] : ["down", "up"],
    enabled: route.kind !== "home",
    onSwipe: (direction) => {
      if (direction === "up") setSheetExpanded(true);
      else if (sheetExpanded) setSheetExpanded(false);
      else clear();
    },
  });

  if (wide || route.kind === "home") return null;

  const offset = drag?.direction === "down" ? drag.offset : drag?.direction === "up" ? -drag.offset : 0;
  return (
    <section
      aria-label="Selected place"
      {...handlers}
      style={offset ? { transform: `translateY(${Math.max(offset, -80)}px)`, transition: "none" } : undefined}
      className={`absolute inset-x-0 bottom-0 z-20 flex min-h-0 flex-col rounded-t-2xl bg-card text-card-foreground shadow-[0_0_0_1px_var(--border),0_-4px_16px_rgb(0_0_0/0.12)] transition-[transform,max-height] duration-200 ease-out motion-reduce:transition-none ${
        sheetExpanded ? "top-2.5" : "max-h-[45%]"
      }`}
    >
      <Button
        variant="ghost"
        onClick={() => setSheetExpanded(!sheetExpanded)}
        aria-expanded={sheetExpanded}
        aria-label={sheetExpanded ? "Show more map" : "Show more details"}
        className="flex h-6 min-h-0 w-full rounded-none rounded-t-2xl px-0 hover:bg-transparent"
        data-no-swipe=""
      >
        <span aria-hidden="true" className="h-1 w-10 rounded-full bg-muted-foreground/50" />
      </Button>
      <SelectionPanel density="compact" frameClassName="px-2 pb-3" bounded={sheetExpanded} />
    </section>
  );
}
