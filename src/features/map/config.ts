import type { ResolvedTheme } from "@/lib/use-resolved-theme";

// The id the campus map registers under in <MapProvider>.
export const CAMPUS_MAP_ID = "campus";

// Central Ann Arbor and the U-M campuses: [west, south, east, north].
export const CAMPUS_BOUNDS: [number, number, number, number] = [
  -83.785, 42.248, -83.678, 42.318,
];

export const CAMPUS_MIN_ZOOM = 12;
export const CAMPUS_MAX_ZOOM = 19;

export const CAMPUS_INITIAL_VIEW = {
  longitude: -83.738,
  latitude: 42.278,
  zoom: 14,
};

const MAPTILER_STYLES: Record<ResolvedTheme, string> = {
  light: "dataviz-v4",
  dark: "019c7246-db79-7039-ad61-ed0035a09174",
};

// Keyless OSM styles, used when NEXT_PUBLIC_MAPTILER_KEY isn't set.
const OPENFREEMAP_STYLES: Record<ResolvedTheme, string> = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

export function mapStyleUrl(theme: ResolvedTheme) {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (!key) return OPENFREEMAP_STYLES[theme];
  return `https://api.maptiler.com/maps/${MAPTILER_STYLES[theme]}/style.json?key=${key}`;
}
