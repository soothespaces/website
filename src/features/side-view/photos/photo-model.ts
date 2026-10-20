// Labels, filters and order for the photos gallery. Google photos are never
// shown. Visitor versus official comes from the credit line.

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
  spaceId: string | null;
  spaceName: string | null;
  spaceSlug: string | null;
  spaceFloor: number | null;
  createdAt: string;
  uploadedBy: string | null;
  isListed: boolean;
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

export type PhotoGroup = {
  key: string;
  label: string;
  photos: ClassifiedPhoto[];
};

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
    if (photo.hidden) return false;
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

const FLOOR_LAST = 10_000;

function floorRank(photo: ClassifiedPhoto): number {
  const floor = photo.floor ?? photo.spaceFloor;
  return floor == null ? FLOOR_LAST : floor;
}

function groupMeta(photo: ClassifiedPhoto): { key: string; label: string; spot: boolean } {
  if (photo.roomNumber) {
    const floor = photo.floor == null ? "" : `Floor ${photo.floor} · `;
    return { key: `room:${photo.floor ?? "x"}:${photo.roomNumber}`, label: `${floor}Room ${photo.roomNumber}`, spot: false };
  }
  if (photo.spaceId) {
    return { key: `space:${photo.spaceId}`, label: photo.spaceName?.trim() || "Study space", spot: false };
  }
  if (photo.lat != null && photo.lng != null) {
    const label = photo.floor == null ? "Spot" : `Floor ${photo.floor} spot`;
    return {
      key: `spot:${photo.floor ?? "x"}:${photo.lat.toFixed(4)}:${photo.lng.toFixed(4)}`,
      label,
      spot: true,
    };
  }
  return { key: "building", label: "Building", spot: false };
}

/** Rooms and named spaces first, then spots, low floors before high ones. */
export function groupPhotos(photos: readonly ClassifiedPhoto[]): PhotoGroup[] {
  const groups = new Map<string, PhotoGroup & { floor: number; spot: number }>();
  for (const photo of photos) {
    const meta = groupMeta(photo);
    const floor = floorRank(photo);
    const existing = groups.get(meta.key);
    if (existing) {
      existing.photos.push(photo);
      existing.floor = Math.min(existing.floor, floor);
    } else {
      groups.set(meta.key, {
        key: meta.key,
        label: meta.label,
        photos: [photo],
        floor,
        spot: meta.spot ? 1 : 0,
      });
    }
  }

  const ordered = [...groups.values()].sort(
    (a, b) => a.floor - b.floor || a.spot - b.spot || a.label.localeCompare(b.label),
  );
  for (const group of ordered) {
    group.photos.sort((a, b) => {
      const spot = Number(a.lat != null) - Number(b.lat != null);
      if (spot !== 0) return spot;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }
  return ordered.map(({ key, label, photos: grouped }) => ({ key, label, photos: grouped }));
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

export function photoFileUrl(supabaseUrl: string, pathPrefix: string, width: number): string {
  const base = supabaseUrl.replace(/\/$/, "");
  const prefix = pathPrefix.replace(/^\//, "");
  return `${base}/storage/v1/object/public/${prefix}-${width}.webp`;
}

/** Left goes to the next photo, right to the previous. A short or vertical drag is ignored. */
export function swipeDirection(dx: number, dy: number): "next" | "prev" | null {
  if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.35) return null;
  return dx < 0 ? "next" : "prev";
}

export function photoSrcSet(supabaseUrl: string, pathPrefix: string, widths: readonly number[]): string {
  return orderedWidths(widths)
    .map((width) => `${photoFileUrl(supabaseUrl, pathPrefix, width)} ${width}w`)
    .join(", ");
}
