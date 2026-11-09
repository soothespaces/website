// Shared by the /admin/photos pages, their server actions and the browser.

import { photoUrl } from "@/lib/photos/url";

export const BUCKET = "photos";
/** Private bucket for the files of unlisted photos (QA-006). Same file names as in BUCKET. */
export const HIDDEN_BUCKET = "photos-hidden";

// The same widths and quality as scripts/photos/import.mjs, so admin uploads
// and imported photos are served the same way.
export const WIDTHS = { photo: [480, 960, 1600], panorama: [2048, 4096] } as const;
export const WEBP_QUALITY = 75;

// What the browser sends: the longest side it downscales to before upload,
// and the most it sends. Vercel caps a function's request body at 4.5 MB;
// next.config.ts lets Server Actions take up to 4 MB.
export const UPLOAD_MAX_SIDE = { photo: 2400, panorama: 4096 } as const;
export const UPLOAD_MAX_BYTES = 3.8 * 1024 * 1024;

export const DEFAULT_CREDIT = "Soothe Spaces team";
export const DEFAULT_LICENSE = "Soothe Spaces team photo";

export type PhotoKind = keyof typeof WIDTHS;

/**
 * What a photo is tagged to. Every photo belongs to a building; a room adds
 * the floor and the room number from the floor plan, and a spot adds where
 * on the plan the photo was taken (with the room it falls in, if any).
 */
export type PhotoTags = {
  buildingSlug: string;
  floor: number | null;
  roomNumber: string | null;
  lat: number | null;
  lng: number | null;
  /** Compass direction the camera faced, 0 = north, clockwise. Needs a spot. */
  heading: number | null;
};

export type PhotoDetails = {
  alt: string;
  credit: string;
  license: string;
  kind: PhotoKind;
  isListed: boolean;
};

export type AdminPhoto = PhotoTags &
  PhotoDetails & {
    id: string;
    pathPrefix: string;
    widths: number[];
    width: number;
    height: number;
    sourceUrl: string | null;
    /** Whether an admin uploaded it here (not the import script). */
    uploaded: boolean;
    /** The uploading admin's email, read through photo_uploaders() on the editor page only. */
    uploadedBy: string | null;
    createdAt: string;
    /** Signed URLs by width for an unlisted photo, whose files are private. */
    signed: Record<number, string> | null;
  };

/** Where to load one width of an admin photo from. */
export function adminPhotoSrc(supabaseUrl: string, photo: Pick<AdminPhoto, "pathPrefix" | "signed">, width: number) {
  return photo.signed?.[width] ?? photoUrl(supabaseUrl, photo.pathPrefix, width);
}

export { photoUrl };

/** The widths a photo is stored at: the kind's widths below its own, then its own. Never upscaled. */
export function widthsFor(kind: PhotoKind, width: number) {
  const widths: number[] = WIDTHS[kind].filter((w) => w < width);
  if (widths.length < WIDTHS[kind].length) widths.push(width);
  return widths;
}

export function describeTags(tags: Pick<PhotoTags, "floor" | "roomNumber" | "lat">) {
  const parts = [];
  if (tags.floor != null) parts.push(`floor ${tags.floor}`);
  if (tags.roomNumber) parts.push(`room ${tags.roomNumber}`);
  if (tags.lat != null) parts.push("spot");
  return parts.length ? parts.join(", ") : "whole building";
}
