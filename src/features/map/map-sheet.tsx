"use client";

import { useState } from "react";
import { useMediaQuery } from "@/lib/use-media-query";
import { WIDE_QUERY } from "./map-layout-config";
import { useMapState } from "./map-state";
import { SelectionPanel } from "./panel/selection-panel";
import { useSwipeToDismiss } from "./use-swipe-to-dismiss";
import { Button } from "@/components/ui/button";

// Phones: Home, or what's selected, in a sheet over the bottom of the map.
// The handle (or a swipe up) expands it. A swipe down collapses it, and
// closes a selected place. Home stays up. Your spots opens tall so Sign in
// is not under the map controls, and a collapse lasts only until the next open.
export function MapSheet() {
  const wide = useMediaQuery(WIDE_QUERY);
  const { route, clear } = useMapState();
  const home = route.kind === "home";
  const spots = route.kind === "my-spots";
  const [expanded, setExpanded] = useState(false);
  const [spotsCollapsed, setSpotsCollapsed] = useState(false);
  const [seen, setSeen] = useState(route.kind);
  if (seen !== route.kind) {
    setSeen(route.kind);
    setExpanded(false);
    if (route.kind === "my-spots") setSpotsCollapsed(false);
  }
  const tall = spots ? !spotsCollapsed : expanded;
  const setTall = (next: boolean) => {
    if (spots) setSpotsCollapsed(!next);
    else setExpanded(next);
  };
  const { drag, handlers } = useSwipeToDismiss({
    directions: tall ? ["down"] : home ? ["up"] : ["down", "up"],
    enabled: !wide,
    onSwipe: (direction) => {
      if (direction === "up") setTall(true);
      else if (tall) setTall(false);
      else if (!home) clear();
    },
  });

  if (wide) return null;

  const offset = drag?.direction === "down" ? drag.offset : drag?.direction === "up" ? -drag.offset : 0;
  return (
    <section
      aria-label={home ? "Study spaces" : "Selected place"}
      {...handlers}
      style={offset ? { transform: `translateY(${Math.max(offset, -80)}px)`, transition: "none" } : undefined}
      className={`absolute inset-x-0 bottom-0 z-20 flex min-h-0 flex-col rounded-t-2xl bg-card text-card-foreground shadow-[0_0_0_1px_var(--border),0_-4px_16px_rgb(0_0_0/0.12)] transition-[transform,max-height] duration-200 ease-out motion-reduce:transition-none ${
        tall ? "top-2.5" : "max-h-[45%]"
      }`}
    >
      <Button
        variant="ghost"
        onClick={() => setTall(!tall)}
        aria-expanded={tall}
        aria-label={tall ? "Show more map" : "Show more details"}
        className="flex h-6 min-h-0 w-full rounded-none rounded-t-2xl px-0 hover:bg-transparent"
        data-no-swipe=""
      >
        <span aria-hidden="true" className="h-1 w-10 rounded-full bg-muted-foreground/50" />
      </Button>
      <SelectionPanel density="compact" frameClassName="px-2 pb-3" bounded={tall || home} />
    </section>
  );
}
