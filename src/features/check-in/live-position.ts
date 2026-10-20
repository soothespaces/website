"use client";

import { useEffect, useSyncExternalStore } from "react";
import { requestOneShotPosition, type Coordinates } from "@/lib/location";
import { useLocation } from "@/lib/location/use-location";

// A fresh fix while the map is open and location is already allowed.
// One-shot reads only — never watchPosition — and only while the tab is visible.

const POLL_MS = 20_000;

export type LiveFix = Coordinates & { at: number };

let fix: LiveFix | null = null;
const listeners = new Set<() => void>();
let pollers = 0;
let timer = 0;
let generation = 0;

function emit() {
  for (const listener of listeners) listener();
}

export function publishFix(coords: Coordinates): void {
  fix = { latitude: coords.latitude, longitude: coords.longitude, at: Date.now() };
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getFix() {
  return fix;
}

function getServerFix() {
  return null;
}

async function sample(current: number) {
  if (current !== generation) return;
  if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
  const result = await requestOneShotPosition({
    enableHighAccuracy: true,
    timeout: 10_000,
    maximumAge: 0,
  });
  if (current !== generation || !result.coords) return;
  publishFix(result.coords);
}

function beginPolling() {
  generation += 1;
  const current = generation;
  const loop = () => {
    void sample(current);
    timer = window.setTimeout(loop, POLL_MS);
  };
  loop();
}

function endPolling() {
  generation += 1;
  window.clearTimeout(timer);
}

export function useGrantedPosition(): LiveFix | null {
  const { permission, position } = useLocation();
  const live = useSyncExternalStore(subscribe, getFix, getServerFix);

  useEffect(() => {
    if (position) publishFix(position);
  }, [position]);

  useEffect(() => {
    if (permission !== "granted") return;
    pollers += 1;
    if (pollers === 1) beginPolling();
    return () => {
      pollers -= 1;
      if (pollers === 0) endPolling();
    };
  }, [permission]);

  if (permission !== "granted") return null;
  return live;
}
