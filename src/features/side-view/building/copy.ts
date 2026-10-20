import type { StudyPreferences } from "@/lib/settings/model";

const DIRECTION = /^(?:[NSEW]|NE|NW|SE|SW)\.?$/i;

/** "919 S. UNIVERSITY AVE" is stored in capitals. The board shows title case. */
export function displayAddress(raw: string): string {
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed !== trimmed.toUpperCase()) return trimmed;
  return trimmed
    .split(" ")
    .map((word) => {
      if (DIRECTION.test(word)) return word.toUpperCase();
      if (/^\d/.test(word)) return word;
      return word.charAt(0) + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export function buildingSubtitle(acronym: string | null | undefined, address: string | null | undefined): string | null {
  const parts = [acronym?.trim() || null, address ? displayAddress(address) : null].filter(
    (part): part is string => !!part,
  );
  return parts.length ? parts.join(" · ") : null;
}

export function entranceSummary(accessible: number, automatic: number): string {
  if (accessible <= 0) return "No accessible entrances on record";
  return `${accessible} accessible, ${automatic} automatic`;
}

export function photoCount(count: number): string {
  return count === 1 ? "1 photo" : `${count} photos`;
}

export function seeAllSpaces(count: number): string {
  return `See all ${count}`;
}

export function seeAllRooms(count: number): string {
  return `See all ${count} ${count === 1 ? "room" : "rooms"}`;
}

export function floorMeta(floor: number | null): string | null {
  if (floor == null) return null;
  if (floor === 0) return "Basement";
  return `Floor ${floor}`;
}

export function seatMeta(capacity: number | null): string | null {
  if (capacity == null || capacity <= 0) return null;
  return capacity === 1 ? "1 seat" : `${capacity} seats`;
}

export function roomMeta(floor: number | null, capacity: number | null): string {
  return [floorMeta(floor), seatMeta(capacity)].filter(Boolean).join(" · ");
}

export function roomName(title: string, roomNumber: string | null): string {
  const bare = title.replace(/\s*\(Capacity \d+\)\s*$/i, "").trim();
  const booth = bare.match(/booth\s*(\d+)/i);
  if (booth) return `Booth ${booth[1]}`;
  if (roomNumber && /\d/.test(roomNumber)) return `Room ${roomNumber}`;
  const embedded = bare.match(/\b(\d{3,5}[A-Z]?)\b/);
  if (embedded && /room|floor/i.test(bare)) return `Room ${embedded[1]}`;
  return bare || "Room";
}

export function hasStudyPreferences(study: StudyPreferences): boolean {
  return (
    study.noise !== "any" ||
    study.setting !== "any" ||
    study.brightness !== "any" ||
    study.daylight !== "any" ||
    study.niceToHave.length > 0 ||
    study.when.length > 0
  );
}

export function isGooglePhoto(photo: { sourceUrl?: string | null; license?: string | null; credit?: string | null }): boolean {
  const blob = `${photo.sourceUrl ?? ""} ${photo.license ?? ""} ${photo.credit ?? ""}`.toLowerCase();
  return blob.includes("google") || blob.includes("gstatic") || blob.includes("ggpht") || blob.includes("googleapis");
}
