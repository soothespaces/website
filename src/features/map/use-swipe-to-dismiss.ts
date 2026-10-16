"use client";

import { useRef, useState } from "react";

// How far a finger has to travel, in pixels, to count as a swipe.
const SWIPE_DISTANCE = 56;
// How much more it has to move along the swipe than across it.
const DOMINANCE = 1.35;
// Touches that start on these are theirs, not a swipe.
const IGNORE = "input, textarea, select, a, [data-no-swipe]";

type Direction = "left" | "down" | "up";

// Follows a finger dragging a panel in one of `directions` and calls
// onSwipe with the direction once it lets go far enough. `offset` is how far
// the panel has been dragged (positive along the drag), for a transform
// while the finger is down. Adapted from MaizeMeals' locations drawer.
export function useSwipeToDismiss({
  directions,
  onSwipe,
  enabled = true,
}: {
  directions: Direction[];
  onSwipe: (direction: Direction) => void;
  enabled?: boolean;
}) {
  const [drag, setDrag] = useState<{ direction: Direction; offset: number } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<"unknown" | "x" | "y" | "none">("unknown");

  const reset = () => {
    start.current = null;
    axis.current = "unknown";
    setDrag(null);
  };

  const along = (dx: number, dy: number): { direction: Direction; offset: number } | null => {
    if (axis.current === "x" && directions.includes("left") && dx < 0) return { direction: "left", offset: -dx };
    if (axis.current === "y" && directions.includes("down") && dy > 0) return { direction: "down", offset: dy };
    if (axis.current === "y" && directions.includes("up") && dy < 0) return { direction: "up", offset: -dy };
    return null;
  };

  const onTouchStart = (event: React.TouchEvent) => {
    if (!enabled || (event.target as HTMLElement).closest(IGNORE)) return;
    const touch = event.touches[0];
    start.current = { x: touch.clientX, y: touch.clientY };
    axis.current = "unknown";
  };

  const onTouchMove = (event: React.TouchEvent) => {
    if (!start.current) return;
    const touch = event.touches[0];
    const dx = touch.clientX - start.current.x;
    const dy = touch.clientY - start.current.y;
    if (axis.current === "unknown") {
      const [ax, ay] = [Math.abs(dx), Math.abs(dy)];
      if (ax > 12 && ax > ay * DOMINANCE) axis.current = "x";
      else if (ay > 12 && ay > ax * DOMINANCE) axis.current = "y";
      else return;
    }
    setDrag(along(dx, dy));
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    const origin = start.current;
    if (origin) {
      const touch = event.changedTouches[0];
      const swipe = along(touch.clientX - origin.x, touch.clientY - origin.y);
      if (swipe && swipe.offset > SWIPE_DISTANCE) onSwipe(swipe.direction);
    }
    reset();
  };

  return { drag, handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: reset } };
}
