"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { SpaceListDensity } from "@/features/spaces";
import { panelRouteKey, type PanelRoute } from "@/features/side-view/panel-route";
import { panelRegistry } from "@/features/side-view/registry";
import { useMapState } from "../map-state";
import { PanelHeader } from "./panel-header";

// Detail screens scroll their own body when the frame is a fixed-height column.
// A collapsed phone sheet scrolls the frame instead, so the list can grow.
function scrollContainer(frame: HTMLElement): HTMLElement {
  const detail = frame.querySelector<HTMLElement>("[data-detail-scroll]");
  if (!detail) return frame;
  const overflow = getComputedStyle(frame).overflowY;
  return overflow === "auto" || overflow === "scroll" ? frame : detail;
}

const TITLES: Record<PanelRoute["kind"], string> = {
  home: "Home",
  building: "Building",
  hours: "Hours",
  spaces: "Spaces",
  rooms: "Rooms",
  "rooms-map": "Rooms map",
  photos: "Photos",
  space: "Space",
  preferences: "Preferences",
  "my-spots": "Your spots",
};

// A route with no screen yet. Wave 1 fills these in through the registry.
function PanelPlaceholder({ route }: { route: PanelRoute }) {
  const title = TITLES[route.kind];
  return (
    <div className="flex flex-col gap-1 px-3">
      <h2 className="text-lg">{title}</h2>
      <p className="text-sm text-muted-foreground">{title} isn’t ready yet.</p>
    </div>
  );
}

function PanelFrame({
  route,
  active,
  canGoBack,
  density,
  frameClassName,
  bounded,
  scrolls,
  onBack,
  onClose,
}: {
  route: PanelRoute;
  active: boolean;
  canGoBack: boolean;
  density: SpaceListDensity;
  frameClassName: string;
  // The dock, and the phone sheet once it is expanded, have a fixed height
  // and the frame fills it. A collapsed sheet sizes to its content.
  bounded: boolean;
  scrolls: Map<string, number>;
  onBack: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const key = panelRouteKey(route);
  const Screen = panelRegistry[route.kind];
  const detail = Screen?.detailScreen === true;

  // Scroll lives on the frame, or on the detail screen's own scroller.
  // Back hides the frame instead of unmounting it. The saved offset covers a
  // browser that zeroes scrollTop when the frame is hidden: hiding sets
  // `inert` before this effect's cleanup, so a cleanup read would save the
  // wrong place. The scroll listener records the position while it is visible.
  useLayoutEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    const scroller = scrollContainer(frame);
    if (active) {
      const saved = scrolls.get(key);
      if (saved != null && scroller.scrollTop !== saved) scroller.scrollTop = saved;
    }
    const remember = () => {
      if (!frame.hasAttribute("inert")) scrolls.set(key, scroller.scrollTop);
    };
    scroller.addEventListener("scroll", remember, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", remember);
      if (!frame.hasAttribute("inert")) scrolls.set(key, scroller.scrollTop);
    };
  }, [active, bounded, key, scrolls]);

  let body: ReactNode = <PanelPlaceholder route={route} />;
  if (Screen) body = <Screen route={route} density={density} />;

  return (
    <div
      ref={ref}
      data-panel-kind={route.kind}
      data-panel-key={key}
      data-panel-active={active ? "true" : "false"}
      aria-hidden={active ? undefined : true}
      inert={active ? undefined : true}
      className={
        active
          ? detail
            ? bounded
              ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden"
              : "min-h-0"
            : `overflow-y-auto overscroll-contain ${frameClassName} ${bounded ? "min-h-0 flex-1" : "min-h-0"}`
          : "hidden"
      }
    >
      {detail ? (
        <div className={bounded ? "flex h-full min-h-0 flex-1 flex-col" : "flex flex-col"}>{body}</div>
      ) : (
        <div className="flex flex-col gap-1">
          <PanelHeader canGoBack={canGoBack} onBack={onBack} onClose={onClose} />
          {body}
        </div>
      )}
    </div>
  );
}

// The panel stack. Shared by the dock and the phone sheet, which only differ
// in the frame around it. Screens under the top one stay mounted so Back
// returns to them where they were scrolled.
export function SelectionPanel({
  density,
  frameClassName = "p-2",
  bounded = true,
}: {
  density: SpaceListDensity;
  frameClassName?: string;
  bounded?: boolean;
}) {
  const { stack, back, clear } = useMapState();
  const [scrolls] = useState(() => new Map<string, number>());
  const rootRef = useRef<HTMLDivElement>(null);

  const onBack = () => {
    // Read the position before Back hides the frame.
    const frame = rootRef.current?.querySelector<HTMLElement>("[data-panel-active='true']");
    const key = frame?.dataset.panelKey;
    const scroller = frame ? scrollContainer(frame) : null;
    if (scroller && key) scrolls.set(key, scroller.scrollTop);
    back();
  };

  return (
    <div ref={rootRef} className={`flex min-h-0 flex-col ${bounded ? "flex-1" : ""}`}>
      {stack.map((route, index) => {
        // Home is the search results until a screen registers for it.
        if (route.kind === "home" && !panelRegistry.home) return null;
        return (
          <PanelFrame
            key={panelRouteKey(route)}
            route={route}
            active={index === stack.length - 1}
            canGoBack={index > 0}
            density={density}
            frameClassName={frameClassName}
            bounded={bounded}
            scrolls={scrolls}
            onBack={onBack}
            onClose={clear}
          />
        );
      })}
    </div>
  );
}
