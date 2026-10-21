// Labels, filters and order for the photos gallery. Google photos are never
// shown. Visitor versus official comes from the credit line.

import { pointInPolygon } from "@/lib/geo";
import { photoUrl } from "@/lib/photos/url";
import { sameRoomNumber } from "@/lib/data/room-number";

export type GalleryPhoto = {
  id: string;
  pathPrefix: string;
  widths: number[];
  width: number;
  height: number;
  alt: string;
  credit: string;
  license: string;
  sourceUrl: string | null;
  sortOrder: number;
  kind: string;
  floor: number | null;
  roomNumber: string | null;
  lat: number | null;
  lng: number | null;
  /** The row's space_id. Admin uploads leave this empty and tag a room instead. */
  spaceId: string | null;
  buildingSlug: string | null;
  /** Set when the photo belongs to a space, including a room or spot match. */
  spaceName: string | null;
  spaceSlug: string | null;
  createdAt: string;
  isListed: boolean;
};

export type SpaceLocationRef = {
  floor: number;
  roomNumber: string | null;
  /** GeoJSON Polygon, or null for a room that is only a number. */
  area: unknown;
};

export type SpaceRef = {
  id: string;
  slug: string;
  name: string;
  buildingSlug: string;
  locations: readonly SpaceLocationRef[];
};

export type PhotoSource = "visitor" | "official";

export type ClassifiedPhoto = GalleryPhoto & {
  /** Google, Yelp and unlisted photos stay out of every filter. */
  hidden: boolean;
  source: PhotoSource;
  pill: string;
  caption: string;
};

export type PhotoFilter = "all" | "visitors" | "official";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

// Hosts and credits we are not allowed to republish.
const BLOCKED = /google|gstatic|ggpht|serpapi|yelp/i;

export function isBlockedPhoto(photo: Pick<GalleryPhoto, "credit" | "license" | "sourceUrl">): boolean {
  return BLOCKED.test(`${photo.credit}\n${photo.license}\n${photo.sourceUrl ?? ""}`);
}

export function formatCreditMonth(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function isVisitorCredit(credit: string, license: string): boolean {
  return /\bvisitors?\b/i.test(credit) || /\bvisitors?\b/i.test(license);
}

function shortCredit(credit: string): string {
  const first = credit.split(",")[0]?.trim() || credit.trim();
  if (first.length <= 40) return first;
  return `${first.slice(0, 39).trimEnd()}…`;
}

/** The pill under a photo, and which chip it belongs to. */
export function creditPill(photo: Pick<GalleryPhoto, "credit" | "license" | "createdAt">): {
  source: PhotoSource;
  label: string;
} {
  if (isVisitorCredit(photo.credit, photo.license)) {
    const month = formatCreditMonth(photo.createdAt);
    return { source: "visitor", label: month ? `Visitor · ${month}` : "Visitor" };
  }
  if (/wikimedia/i.test(photo.credit) || /wikimedia/i.test(photo.license)) {
    return { source: "official", label: "Wikimedia Commons" };
  }
  if (/library/i.test(photo.credit) && /michigan|u-m|\bum\b/i.test(photo.credit)) {
    return { source: "official", label: "U-M Library" };
  }
  if (/soothe spaces/i.test(photo.credit) || /soothe spaces/i.test(photo.license)) {
    return { source: "official", label: "Soothe Spaces" };
  }
  return { source: "official", label: shortCredit(photo.credit) };
}

export function photoCaption(photo: Pick<GalleryPhoto, "alt" | "spaceName" | "roomNumber">): string {
  const alt = photo.alt.trim();
  if (alt) return alt;
  if (photo.spaceName?.trim()) return photo.spaceName.trim();
  if (photo.roomNumber) return `Room ${photo.roomNumber}`;
  return "Photo";
}

export function classifyPhoto(photo: GalleryPhoto): ClassifiedPhoto {
  const pill = creditPill(photo);
  return {
    ...photo,
    hidden: !photo.isListed || isBlockedPhoto(photo),
    source: pill.source,
    pill: pill.label,
    caption: photoCaption(photo),
  };
}

export function filterPhotos(photos: readonly ClassifiedPhoto[], filter: PhotoFilter): ClassifiedPhoto[] {
  return photos.filter((photo) => {
    if (photo.hidden || photo.kind === "panorama") return false;
    if (filter === "visitors") return photo.source === "visitor";
    if (filter === "official") return photo.source === "official";
    return true;
  });
}

export function photoCountLabel(count: number): string {
  if (count === 0) return "No photos";
  if (count === 1) return "1 photo";
  return `${count} photos`;
}

type PhotoMatch = Pick<GalleryPhoto, "spaceId" | "buildingSlug" | "floor" | "roomNumber" | "lat" | "lng">;

function polygonRing(area: unknown): readonly (readonly [number, number])[] | null {
  if (!area || typeof area !== "object") return null;
  const coordinates = (area as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coordinates) || !Array.isArray(coordinates[0])) return null;
  const ring: [number, number][] = [];
  for (const point of coordinates[0]) {
    if (!Array.isArray(point) || point.length < 2) return null;
    const lng = point[0];
    const lat = point[1];
    if (typeof lng !== "number" || typeof lat !== "number") return null;
    ring.push([lng, lat]);
  }
  return ring.length >= 3 ? ring : null;
}

/**
 * The space a photo belongs to. Direct `space_id` wins, then a room number
 * on the same floor, then a spot inside a location's outline.
 */
export function photoSpace(photo: PhotoMatch, spaces: readonly SpaceRef[]): SpaceRef | null {
  if (photo.spaceId) {
    const direct = spaces.find((space) => space.id === photo.spaceId);
    if (direct) return direct;
  }

  if (photo.buildingSlug && photo.floor != null && photo.roomNumber) {
    const byRoom = spaces.find(
      (space) =>
        space.buildingSlug === photo.buildingSlug &&
        space.locations.some(
          (location) => location.floor === photo.floor && sameRoomNumber(location.roomNumber, photo.roomNumber),
        ),
    );
    if (byRoom) return byRoom;
  }

  if (photo.buildingSlug && photo.floor != null && photo.lat != null && photo.lng != null) {
    const point = { lat: photo.lat, lng: photo.lng };
    const bySpot = spaces.find(
      (space) =>
        space.buildingSlug === photo.buildingSlug &&
        space.locations.some((location) => {
          if (location.floor !== photo.floor) return false;
          const ring = polygonRing(location.area);
          return ring != null && pointInPolygon(point, ring);
        }),
    );
    if (bySpot) return bySpot;
  }

  return null;
}

export function photosForSpace<T extends PhotoMatch>(
  photos: readonly T[],
  space: SpaceRef,
  spaces: readonly SpaceRef[],
): T[] {
  return photos.filter((photo) => photoSpace(photo, spaces)?.id === space.id);
}

/** Spaces first, then the rest of the building. Within each, saved order then date. */
export function orderPhotos<T extends Pick<GalleryPhoto, "spaceSlug" | "sortOrder" | "createdAt">>(
  photos: readonly T[],
): T[] {
  return [...photos].sort((a, b) => {
    const placed = Number(b.spaceSlug != null) - Number(a.spaceSlug != null);
    if (placed !== 0) return placed;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function orderedWidths(widths: readonly number[]): number[] {
  return [...widths].filter((width) => Number.isFinite(width) && width > 0).sort((a, b) => a - b);
}

/** Largest stored width that still fits the screen. The smallest, if none do. */
export function widthThatFits(widths: readonly number[], cssPixels: number, pixelRatio = 1): number | null {
  const sorted = orderedWidths(widths);
  if (!sorted.length) return null;
  const ratio = pixelRatio > 0 ? pixelRatio : 1;
  const target = Math.max(1, Math.round(cssPixels * ratio));
  let fit: number | null = null;
  for (const width of sorted) {
    if (width <= target) fit = width;
  }
  return fit ?? sorted[0];
}

/** Smallest stored width that covers a request. The largest, if none do. */
export function widthAtLeast(widths: readonly number[], requested: number): number | null {
  const sorted = orderedWidths(widths);
  if (!sorted.length) return null;
  return sorted.find((width) => width >= requested) ?? sorted[sorted.length - 1];
}

export function photoSrcSet(supabaseUrl: string, pathPrefix: string, widths: readonly number[]): string {
  return orderedWidths(widths)
    .map((width) => `${photoUrl(supabaseUrl, pathPrefix, width)} ${width}w`)
    .join(", ");
}
