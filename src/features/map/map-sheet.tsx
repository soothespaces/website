"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { panelRouteKey } from "@/features/side-view/panel-route";
import { panelRegistry, tallSheetKinds } from "@/features/side-view/registry";
import { useMediaQuery } from "@/lib/use-media-query";
import { WIDE_QUERY } from "./map-layout-config";
import { useMapState } from "./map-state";
import { SelectionPanel } from "./panel/selection-panel";
import { useSwipeToDismiss } from "./use-swipe-to-dismiss";
import { Button } from "@/components/ui/button";

// Phones: Home, or what's selected, in a sheet over the bottom of the map.
// The handle (or a swipe up) expands it. A swipe down collapses it, and
// closes a selected place. Home stays up.
export function MapSheet() {
  const wide = useMediaQuery(WIDE_QUERY);
  const { route, clear } = useMapState();
  const home = route.kind === "home";
  const tall = tallSheetKinds.has(route.kind) && Boolean(panelRegistry[route.kind]);
  const [expanded, setExpanded] = useState(tall);
  // Another place, or another screen, starts again at the peek (QA-019).
  const routeKey = panelRouteKey(route);
  const [seen, setSeen] = useState(routeKey);
  if (seen !== routeKey) {
    setSeen(routeKey);
    // Preferences and Your spots open tall. Other screens open at the peek.
    setExpanded(tall);
  }
  const sheetRef = useRef<HTMLElement>(null);
  // The sheet's height and the room above it when a touch starts.
  const [bounds, setBounds] = useState({ start: 0, room: 0 });

  // Expanded, the sheet covers the map, its controls and the search bar.
  // Take them out of the tab order and away from screen readers while it
  // does (QA-008). They're the elements before the sheet in the map column.
  useEffect(() => {
    const sheet = sheetRef.current;
    if (wide || !expanded || !sheet) return;
    const covered: Element[] = [];
    for (let el = sheet.previousElementSibling; el; el = el.previousElementSibling) {
      if (!el.hasAttribute("inert")) {
        el.setAttribute("inert", "");
        covered.push(el);
      }
    }
    return () => covered.forEach((el) => el.removeAttribute("inert"));
  }, [wide, expanded]);
  const { drag, handlers } = useSwipeToDismiss({
    directions: expanded ? ["down"] : home ? ["up"] : ["down", "up"],
    enabled: !wide,
    onSwipe: (direction) => {
      if (direction === "up") setExpanded(true);
      else if (expanded) setExpanded(false);
      else if (!home) clear();
    },
  });

  if (wide) return null;

  // Escape closes what's selected, as Close does. On Home it lowers an
  // expanded sheet. Detail screens handle Escape first, as Back.
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    if (home) {
      if (!expanded) return;
      setExpanded(false);
    } else {
      clear();
    }
    event.preventDefault();
    event.stopPropagation();
  }

  // Down drags slide the sheet. Up drags grow it with the finger, up to the
  // expanded height, instead of moving 80px and then jumping (DA-01).
  const down = drag?.direction === "down" ? drag.offset : 0;
  const up = drag?.direction === "up" && !expanded ? drag.offset : 0;
  const dragStyle = down
    ? { transform: `translateY(${down}px)`, transition: "none" }
    : up
      ? { height: `${bounds.start + Math.min(up, bounds.room)}px`, maxHeight: "none", transition: "none" }
      : undefined;
  // The rooms map keeps a real drawer height so the floor stays visible and
  // the list scrolls above the Book row. 60% so the first room rows show at
  // the peek (DA-10).
  const roomsMap = route.kind === "rooms-map";
  return (
    <section
      ref={sheetRef}
      data-map-sheet=""
      aria-label={home ? "Study spaces" : "Selected place"}
      onKeyDown={onKeyDown}
      {...handlers}
      onTouchStart={(event) => {
        const sheet = event.currentTarget;
        const start = sheet.offsetHeight;
        setBounds({ start, room: Math.max(0, (sheet.parentElement?.clientHeight ?? 0) - start) });
        handlers.onTouchStart(event);
      }}
      style={dragStyle}
      // Expanded, the sheet is the full panel from the boards: flush with the
      // header, square corners, no lifted shadow (DA-12).
      className={`absolute inset-x-0 bottom-0 z-20 flex min-h-0 flex-col bg-card text-card-foreground transition-[transform,max-height] duration-200 ease-out motion-reduce:transition-none ${
        expanded || roomsMap ? "overflow-hidden" : ""
      } ${
        expanded
          ? "top-0 rounded-none border-t border-border"
          : `rounded-t-2xl shadow-[0_0_0_1px_var(--border),0_-4px_16px_rgb(0_0_0/0.12)] ${roomsMap ? "h-[60%]" : "max-h-[45%]"}`
      }`}
    >
      <Button
        variant="ghost"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-label={expanded ? "Show more map" : "Show more details"}
        // The ring sits inside the handle: the sheet clips anything outside it
        // (QA-021). A drag on the handle moves the sheet, not the page (DA-01).
        // 44px tall for touch (QA-032); the bar sits near the top edge.
        className={`flex h-11 min-h-0 w-full shrink-0 touch-none items-start rounded-none px-0 pt-2 hover:bg-transparent active:bg-transparent focus-visible:-outline-offset-2 ${
          expanded ? "" : "rounded-t-2xl"
        }`}
      >
        <span aria-hidden="true" className="h-1 w-10 rounded-full bg-muted-foreground/50" />
      </Button>
      <SelectionPanel density="compact" frameClassName="px-2 pb-3" bounded={expanded || roomsMap || home} />
    </section>
  );
}
