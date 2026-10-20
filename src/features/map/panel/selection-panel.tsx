"use client";

import { useLayoutEffect, useRef, useState, type ReactNode, type UIEvent } from "react";
import type { SpaceListDensity } from "@/features/spaces";
import { panelRouteKey, type PanelRoute } from "@/features/side-view/panel-route";
import { detailPanelKinds, panelRegistry } from "@/features/side-view/registry";
import { useMapState } from "../map-state";
import { PanelHeader } from "./panel-header";

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
  // Detail screens bring their own back control. When the frame has a fixed
  // height they fill it, so their footer stays on screen while the body scrolls.
  const detail = Boolean(Screen) && detailPanelKinds.has(route.kind);
  const fill = detail && bounded;

  // Scroll lives on the frame. Back hides it instead of unmounting it. The
  // saved offset covers a browser that zeroes scrollTop when the frame is
  // hidden: hiding sets `inert` before this effect's cleanup, so a cleanup
  // read would save the wrong place.
  useLayoutEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    if (active) {
      const saved = scrolls.get(key);
      if (saved != null && frame.scrollTop !== saved) frame.scrollTop = saved;
    }
    return () => {
      if (!frame.hasAttribute("inert")) scrolls.set(key, frame.scrollTop);
    };
  }, [active, key, scrolls]);

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    scrolls.set(key, event.currentTarget.scrollTop);
  };

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
      onScroll={onScroll}
      className={
        !active
          ? "hidden"
          : fill
            ? `flex min-h-0 flex-1 flex-col overflow-hidden ${frameClassName}`
            : `overflow-y-auto overscroll-contain ${frameClassName} ${bounded ? "min-h-0 flex-1" : "min-h-0"}`
      }
    >
      <div className={fill ? "flex min-h-0 flex-1 flex-col" : "flex flex-col gap-1"}>
        {detail ? null : <PanelHeader canGoBack={canGoBack} onBack={onBack} onClose={onClose} />}
        {body}
      </div>
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
    if (frame && key) scrolls.set(key, frame.scrollTop);
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
