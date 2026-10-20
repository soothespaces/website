"use client";

// A check-in just landed. Screens that show aggregates or history listen
// here, so the sheet doesn't import them.

export type CheckedInEvent = {
  targetKind: "space" | "room";
  targetId: string;
};

type Listener = (event: CheckedInEvent) => void;

const listeners = new Set<Listener>();

export function emitCheckedIn(event: CheckedInEvent): void {
  for (const listener of listeners) listener(event);
}

export function onCheckedIn(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
