"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-motion"],
  });
  return () => {
    media.removeEventListener("change", onChange);
    observer.disconnect();
  };
}

function prefersReducedMotion() {
  // The in-app choice wins when it asks for less motion. Otherwise follow
  // the device, which is also what tokens do when data-motion is absent.
  if (document.documentElement.dataset.motion === "reduce") return true;
  return window.matchMedia(QUERY).matches;
}

// Server render assumes motion is allowed. useSyncExternalStore hydrates
// with that snapshot, then corrects from the device and data-motion.
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}
