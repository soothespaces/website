"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SpaceSearchField } from "@/features/spaces";
import { useMediaQuery } from "@/lib/use-media-query";
import {
  DOCK_MIN_PX,
  DOCK_WIDTH_STORAGE_KEY,
  clampDockWidth,
  defaultDockWidth,
  dockMaxPx,
  dockWidthAfterKey,
  readStoredDockWidth,
} from "./dock-width";
import { WIDE_QUERY } from "./map-layout-config";
import { useMapState } from "./map-state";
import { panelRegistry } from "@/features/side-view/registry";
import { ResultsPanel } from "./panel/results-panel";
import { SelectionPanel } from "./panel/selection-panel";

type DockSize = { width: number; max: number };

// Wide screens: a column on the left of the map that's always there, with
// search on top and the results, or what's selected, below. Its right edge
// drags so the column can grow. Phones use the bottom sheet instead.
export function MapDock() {
  const wide = useMediaQuery(WIDE_QUERY);
  const { search, route } = useMapState();
  const asideRef = useRef<HTMLElement>(null);
  // Null until the stored width is read, so the server and the first client
  // paint share the CSS default and do not mismatch.
  const [size, setSize] = useState<DockSize | null>(null);
  const widthRef = useRef<number | null>(null);
  // A click that never moves is a double-click reset, not a drag to save.
  const drag = useRef({ active: false, moved: false });

  useEffect(() => {
    const measure = () => {
      const view = dockViewport(asideRef.current);
      setSize((current) => ({
        width: current == null ? readStoredDockWidth(readRawWidth(), view) : clampDockWidth(current.width, view),
        max: dockMaxPx(view),
      }));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    widthRef.current = size?.width ?? null;
  }, [size]);

  function commit(next: number) {
    const view = dockViewport(asideRef.current);
    const width = clampDockWidth(next, view);
    widthRef.current = width;
    setSize({ width, max: dockMaxPx(view) });
    writeRawWidth(width);
  }

  // Home stays the search results until its screen registers. The panel
  // scrolls inside itself so a covered screen keeps its place.
  const showResults = route.kind === "home" && !panelRegistry.home;
  return (
    <aside
      ref={asideRef}
      aria-label="Study spaces"
      style={size != null ? { width: size.width } : undefined}
      className={`relative z-10 hidden shrink-0 flex-col border-r border-border bg-background md:flex ${
        size == null ? "w-80 lg:w-96" : ""
      }`}
    >
      {/* Stays mounted on every route. Home hides its own copy from `md` up,
          so typing here does not swap the focused field. */}
      <div className="border-b border-border p-3">
        <SpaceSearchField value={search.query} onChange={search.setQuery} />
      </div>
      {/* Rendered only on wide screens, so the phone sheet and this never
          both hold the panel (and its ids). */}
      {wide ? (
        showResults ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            <ResultsPanel density="compact" />
          </div>
        ) : (
          <SelectionPanel density="compact" frameClassName="py-2 pl-2" />
        )
      ) : null}
      {size != null ? (
        <DockResizeHandle
          width={size.width}
          min={DOCK_MIN_PX}
          max={size.max}
          onPointerDown={() => {
            drag.current = { active: true, moved: false };
          }}
          onDrag={(clientX) => {
            if (!drag.current.active || !asideRef.current) return;
            const left = asideRef.current.getBoundingClientRect().left;
            const view = dockViewport(asideRef.current);
            const width = clampDockWidth(clientX - left, view);
            drag.current.moved = true;
            widthRef.current = width;
            setSize({ width, max: dockMaxPx(view) });
          }}
          onCommit={() => {
            if (!drag.current.active) return;
            const moved = drag.current.moved;
            drag.current = { active: false, moved: false };
            if (moved && widthRef.current != null) writeRawWidth(widthRef.current);
          }}
          onKey={(key, shift) => {
            const view = dockViewport(asideRef.current);
            const current = widthRef.current ?? defaultDockWidth(view);
            const next = dockWidthAfterKey(current, key, shift, view);
            if (next != null) commit(next);
          }}
          onReset={() => {
            drag.current = { active: false, moved: false };
            const view = dockViewport(asideRef.current);
            const width = clampDockWidth(defaultDockWidth(view), view);
            widthRef.current = width;
            setSize({ width, max: dockMaxPx(view) });
            writeRawWidth(null);
          }}
        />
      ) : null}
    </aside>
  );
}

function DockResizeHandle({
  width,
  min,
  max,
  onPointerDown,
  onDrag,
  onCommit,
  onKey,
  onReset,
}: {
  width: number;
  min: number;
  max: number;
  onPointerDown: () => void;
  onDrag: (clientX: number) => void;
  onCommit: () => void;
  onKey: (key: string, shift: boolean) => void;
  onReset: () => void;
}) {
  const hintId = useId();
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize study spaces panel"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(width)}
      aria-valuetext={`${Math.round(width)} pixels`}
      aria-describedby={hintId}
      tabIndex={0}
      // Half of the hit target sits on the map so the border is easy to grab.
      className="group absolute top-0 -right-3 z-20 hidden h-full w-6 cursor-col-resize touch-none select-none md:block focus-visible:outline-none"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        onPointerDown();
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        onDrag(event.clientX);
      }}
      onPointerUp={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.currentTarget.releasePointerCapture(event.pointerId);
        onCommit();
      }}
      onPointerCancel={onCommit}
      onDoubleClick={onReset}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") {
          return;
        }
        event.preventDefault();
        onKey(event.key, event.shiftKey);
      }}
    >
      <span id={hintId} className="sr-only">
        Drag, or use the left and right arrow keys. Home and End jump to the smallest and largest width. Double-click
        restores the usual width.
      </span>
      {/* Sits on the border and out over the map, clear of the cards and the
          scrollbar in the list's end padding. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-1 flex h-8 w-2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background shadow-sm group-hover:border-muted-foreground group-focus-visible:border-ring group-focus-visible:ring-2 group-focus-visible:ring-ring"
      >
        <span className="h-3 w-0.5 rounded-full bg-muted-foreground" />
      </span>
    </div>
  );
}

function dockViewport(aside: HTMLElement | null): number {
  if (typeof window === "undefined") return 1280;
  return aside?.parentElement?.clientWidth || window.innerWidth;
}

function readRawWidth(): string | null {
  try {
    return window.localStorage.getItem(DOCK_WIDTH_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeRawWidth(width: number | null) {
  try {
    if (width == null) window.localStorage.removeItem(DOCK_WIDTH_STORAGE_KEY);
    else window.localStorage.setItem(DOCK_WIDTH_STORAGE_KEY, String(width));
  } catch {
    // Private mode and blocked storage keep the width for this visit only.
  }
}
