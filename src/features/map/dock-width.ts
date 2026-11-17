// Desktop dock width. Phones keep the bottom sheet; this only sizes the
// column beside the map from the `md` breakpoint up.

export const DOCK_MIN_PX = 320;
export const DOCK_MAX_PX = 640;
export const DOCK_DEFAULT_PX = 320;
export const DOCK_DEFAULT_WIDE_PX = 384;
// The map keeps at least this much of the row, so a wide dock cannot cover it.
export const MAP_MIN_PX = 320;
// Tailwind `lg`. At and above this, the unset dock matches the old `lg:w-96`.
export const DOCK_WIDE_BREAKPOINT_PX = 1024;
export const DOCK_WIDTH_STORAGE_KEY = "soothe-dock-width";

const STEP_PX = 16;
const LARGE_STEP_PX = 64;

export function dockMaxPx(viewport: number): number {
  return Math.max(DOCK_MIN_PX, Math.min(DOCK_MAX_PX, Math.floor(viewport) - MAP_MIN_PX));
}

export function defaultDockWidth(viewport: number): number {
  return viewport >= DOCK_WIDE_BREAKPOINT_PX ? DOCK_DEFAULT_WIDE_PX : DOCK_DEFAULT_PX;
}

export function clampDockWidth(width: number, viewport: number): number {
  const max = dockMaxPx(viewport);
  if (!Number.isFinite(width)) return Math.min(defaultDockWidth(viewport), max);
  return Math.round(Math.min(max, Math.max(DOCK_MIN_PX, width)));
}

// `raw` is the stored string. Missing or unreadable values use the default
// for this viewport. A number outside the range is clamped, not discarded.
export function readStoredDockWidth(raw: string | null, viewport: number): number {
  if (raw == null || raw.trim() === "") return clampDockWidth(defaultDockWidth(viewport), viewport);
  return clampDockWidth(Number(raw), viewport);
}

// Arrow keys nudge. Home and End jump to the ends. Anything else returns null.
export function dockWidthAfterKey(width: number, key: string, shift: boolean, viewport: number): number | null {
  const step = shift ? LARGE_STEP_PX : STEP_PX;
  if (key === "ArrowRight") return clampDockWidth(width + step, viewport);
  if (key === "ArrowLeft") return clampDockWidth(width - step, viewport);
  if (key === "Home") return clampDockWidth(DOCK_MIN_PX, viewport);
  if (key === "End") return dockMaxPx(viewport);
  return null;
}
