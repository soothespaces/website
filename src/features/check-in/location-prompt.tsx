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
  LOCATION_SHOW_DELAY_MS,
  dismissLocationPrompt,
  readDismissedUntil,
  readLocationDenied,
  readShownThisVisit,
  rememberLocationDenied,
  rememberShownThisVisit,
  shouldShowLocationPrompt,
} from "./location-prompt-state";

// The card at the bottom of the map that explains location before the
// browser asks (K1 / SOS-136). "Turn on location" is the only call that
// may show the browser prompt.
export function LocationPrompt() {
  const titleId = useId();
  const bodyId = useId();
  const cardRef = useRef<HTMLElement>(null);
  const { permission, request } = useLocation();
  const { route } = useMapState();
  const wide = useMediaQuery(WIDE_QUERY);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (permission === "denied") rememberLocationDenied(window.localStorage);
  }, [permission]);

  useEffect(() => {
    if (permission !== "prompt" && permission !== "unknown") return;
    let ready = false;
    let stopped = false;
    let timer = 0;
    let retry = 0;

    const stop = () => {
      stopped = true;
      window.clearTimeout(timer);
      window.clearInterval(retry);
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };

    const tryShow = () => {
      if (stopped || !ready || isDialogOpen()) return;
      const show = shouldShowLocationPrompt({
        permission,
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

    const arm = () => {
      ready = true;
      tryShow();
    };

    timer = window.setTimeout(arm, LOCATION_SHOW_DELAY_MS);
    retry = window.setInterval(tryShow, 1000);
    window.addEventListener("pointerdown", arm);
    window.addEventListener("keydown", arm);
    return () => stop();
  }, [permission]);

  const visible = open && permission !== "granted" && permission !== "denied";

  useEffect(() => {
    if (visible) cardRef.current?.focus();
  }, [visible]);

  if (!visible) return null;

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

  const lifted = !wide && route.kind !== "home";

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 z-30 flex justify-center px-3 ${lifted ? "bottom-[46%]" : "bottom-14 md:bottom-3"}`}
    >
      <section
        ref={cardRef}
        tabIndex={-1}
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          event.preventDefault();
          notNow();
        }}
        className="pointer-events-auto flex w-[min(22rem,100%)] flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-[0_0_0_1px_var(--border),0_8px_24px_rgb(0_0_0/0.16)] outline-none animate-fade-in"
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
        <div className="flex flex-col gap-2">
          <Button className="w-full" onClick={() => void turnOn()}>
            Turn on location
          </Button>
          <Button className="w-full" variant="outline" onClick={notNow}>
            Not now
          </Button>
        </div>
      </section>
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
