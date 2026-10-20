"use client";

import { useEffect, useRef } from "react";
import { detroitParts } from "@/lib/detroit";
import {
  browserArrivalStore,
  buildingAt,
  dwellReady,
  readArrivalLog,
  wasPromptedToday,
  withArrivalPrompt,
  writeArrivalLog,
} from "./arrival";
import { useArrivalBuildings } from "./buildings";
import { useCheckIn } from "./check-in-context";
import { useGrantedPosition } from "./live-position";
import { isDialogOpen } from "./overlay";

// Opens the arrival sheet after the user has been inside one building for a
// minute. Only while this tab is visible, and at most once per building today.
export function ArrivalWatcher() {
  const fix = useGrantedPosition();
  const buildings = useArrivalBuildings();
  const checkIn = useCheckIn();
  const started = useRef<{ slug: string; at: number } | null>(null);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "visible") started.current = null;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!fix || !checkIn) return;
    if (document.visibilityState !== "visible") {
      started.current = null;
      return;
    }
    const match = buildingAt({ latitude: fix.latitude, longitude: fix.longitude }, buildings);
    if (!match) {
      started.current = null;
      return;
    }
    if (!started.current || started.current.slug !== match.slug) {
      started.current = { slug: match.slug, at: fix.at };
      return;
    }
    if (!dwellReady(started.current.at, fix.at)) return;
    const today = detroitParts(new Date(fix.at)).date;
    const storage = browserArrivalStore();
    if (wasPromptedToday(readArrivalLog(storage), match.slug, today)) {
      started.current = null;
      return;
    }
    if (isDialogOpen()) return;
    writeArrivalLog(withArrivalPrompt(readArrivalLog(storage), match.slug, today), storage);
    started.current = null;
    checkIn.openCheckIn({
      arrivalBuildingSlug: match.slug,
      arrivalBuildingName: match.name,
    });
  }, [fix, buildings, checkIn]);

  return null;
}
