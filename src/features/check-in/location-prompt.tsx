"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PinIcon } from "@/components/ui/icons";
import { useMediaQuery } from "@/lib/use-media-query";
import { useLocation } from "@/lib/location/use-location";
import { WIDE_QUERY } from "@/features/map/map-layout-config";
import { useMapState } from "@/features/map/map-state";
import { isDialogOpen } from "./overlay";
import {
  dismissLocationPrompt,
  readDismissedUntil,
  readLocationDenied,
  readShownThisVisit,
  rememberLocationDenied,
  rememberShownThisVisit,
  shouldShowLocationPrompt,
} from "./location-prompt-state";

// The card on the map that explains location before the browser asks
// (K1 / SOS-136). "Turn on location" is the only call that may show the
// browser prompt.
//
// DA-02: it never opens on a timer and never takes focus. It comes in after
// the visitor touches the map itself (a pan, a tap on the canvas, or a key
// while the map has focus), is announced politely, and sits clear of the
// map's controls: the top-left of the map on wide screens, and under the
// search bar, left of the zoom and locate column, on phones. On a phone it
// only shows over Home, so it never covers a building's plan.
export function LocationPrompt() {
  const titleId = useId();
  const bodyId = useId();
  const cardRef = useRef<HTMLElement>(null);
  const { permission, request } = useLocation();
  const permissionRef = useRef(permission);
  const wide = useMediaQuery(WIDE_QUERY);
  const { route } = useMapState();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    permissionRef.current = permission;
    if (permission === "denied") rememberLocationDenied(window.localStorage);
  }, [permission]);

  useEffect(() => {
    let ready = false;
    let stopped = false;
    let retry = 0;

    const stop = () => {
      stopped = true;
      window.clearInterval(retry);
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };

    const tryShow = () => {
      const current = permissionRef.current;
      if (current === "granted" || current === "denied") {
        stop();
        return;
      }
      if (stopped || !ready || isDialogOpen()) return;
      const show = shouldShowLocationPrompt({
        permission: current,
        now: Date.now(),
        dismissedUntil: readDismissedUntil(window.localStorage),
        deniedForever: readLocationDenied(window.localStorage),
        shownThisVisit: readShownThisVisit(window.sessionStorage),
        ready: true,
      });
      if (!show) {
        if (readShownThisVisit(window.sessionStorage) || readLocationDenied(window.localStorage)) stop();
        const until = readDismissedUntil(window.localStorage);
        if (until != null && Date.now() < until) stop();
        return;
      }
      rememberShownThisVisit(window.sessionStorage);
      setOpen(true);
      stop();
    };

    const arm = (event: Event) => {
      // Only the map itself counts: its canvas, or a key while it has focus.
      // A tap on the sheet, the search bar or a map control is someone
      // reading or picking a place.
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest(".maplibregl-canvas-container, .maplibregl-canvas")) return;
      ready = true;
      tryShow();
    };

    retry = window.setInterval(tryShow, 1000);
    window.addEventListener("pointerdown", arm);
    window.addEventListener("keydown", arm);
    return () => stop();
  }, []);

  const visible = open && permission !== "granted" && permission !== "denied" && (wide || route.kind === "home");

  function notNow() {
    dismissLocationPrompt(Date.now(), window.localStorage);
    rememberShownThisVisit(window.sessionStorage);
    setOpen(false);
  }

  async function turnOn() {
    rememberShownThisVisit(window.sessionStorage);
    setOpen(false);
    await request();
  }

  // Phones: under the search bar and left of the control column (the search
  // bar's own right edge), clear of the sheet. Wide: the map's top-left corner,
  // which nothing else uses.
  return (
    <div
      aria-live="polite"
      className={`pointer-events-none absolute z-30 flex ${wide ? "top-3 left-3" : "top-16 right-[3.75rem] left-2.5"}`}
    >
      {visible ? (
        <section
          ref={cardRef}
          tabIndex={-1}
          role="region"
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            event.preventDefault();
            notNow();
          }}
          className="pointer-events-auto flex w-[min(22rem,100%)] flex-col gap-3 rounded-xl border border-border bg-card p-3 text-card-foreground shadow-[0_0_0_1px_var(--border),0_8px_24px_rgb(0_0_0/0.16)] outline-none animate-fade-in"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <PinIcon size="lg" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 id={titleId} className="text-base">
                See what&apos;s around you
              </h2>
              <p id={bodyId} className="text-sm text-muted-foreground">
                Turn on location to see spaces near you, and we&apos;ll ask how a space is when you get there.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={notNow}>
              Not now
            </Button>
            <Button onClick={() => void turnOn()}>Turn on location</Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

// Settings explains how to undo a browser denial. The map card does not
// ask again after that.
export function LocationSettingsNote() {
  const { permission } = useLocation();
  if (permission !== "denied") return null;
  return (
    <section className="flex flex-col gap-2" aria-labelledby="location-settings">
      <h2 id="location-settings" className="text-xl">
        Location
      </h2>
      <p className="text-muted-foreground">
        Location is off for this site, so the map can&apos;t see what&apos;s around you. To turn it back on, allow
        location for Soothe Spaces in your browser&apos;s site settings, then reload the map.
      </p>
    </section>
  );
}
