import { addDays } from "@/lib/detroit";

// The three public LibCal hosts. Anything else is refused so a bad row can't
// send the server at an arbitrary URL.
export const LIBCAL_INSTANCES = ["umich.libcal.com", "umich-nc.libcal.com", "umich-cc.libcal.com"] as const;
export type LibcalInstance = (typeof LIBCAL_INSTANCES)[number];

/** Booked, as opposed to closed, padding, or free. ADR 0008 / data-sources § 10. */
export const LIBCAL_BOOKED_CLASS = "s-lc-eq-checkout";

const CACHE_MS = 5 * 60 * 1000;

export type BookedInterval = { start: string; end: string };

export type AvailabilityItem = {
  libcalItemId: number;
  booked: BookedInterval[];
};

export type AvailabilityResult = { items: AvailabilityItem[] } | { status: "unavailable" };

export type LibcalLocation = {
  instance: LibcalInstance;
  lid: number;
  kind: "space" | "seat";
  itemIds: number[];
};

export type GridSlot = {
  start: string;
  end: string;
  itemId: number;
  booked: boolean;
};

export function isLibcalInstance(value: string): value is LibcalInstance {
  return (LIBCAL_INSTANCES as readonly string[]).includes(value);
}

export function isUnavailable(result: AvailabilityResult): result is { status: "unavailable" } {
  return "status" in result;
}

/** The location page the seed already fetches. Item metadata, including each room's group id, is inlined there. */
export function locationPageUrl(instance: LibcalInstance, lid: number, kind: "space" | "seat"): string {
  const page = kind === "seat" ? "seats" : "spaces";
  return `https://${instance}/${page}?lid=${lid}&gid=0&c=-1`;
}

export function availabilityGridUrl(instance: LibcalInstance): string {
  return `https://${instance}/spaces/availability/grid`;
}

/**
 * eid/gid pairs from `resources.push({...})`.
 * gid 0 is the page default and the grid returns no slots for it; the rooms
 * themselves carry the group (Shapiro study rooms are gid 5040).
 */
export function parseLibcalGroups(html: string): { eid: number; gid: number }[] {
  const found: { eid: number; gid: number }[] = [];
  const marker = "resources.push(";
  let at = 0;
  while (at < html.length) {
    const start = html.indexOf(marker, at);
    if (start === -1) break;
    const end = html.indexOf(");", start + marker.length);
    if (end === -1) break;
    const block = html.slice(start + marker.length, end);
    const eid = /(?:^|[,\s])eid:\s*(\d+)/.exec(block);
    const gid = /(?:^|[,\s])gid:\s*(\d+)/.exec(block);
    if (eid && gid && gid[1] !== "0") found.push({ eid: Number(eid[1]), gid: Number(gid[1]) });
    at = end + 2;
  }
  return found;
}

/** Null when the body isn't a grid. Checksums are dropped and never returned. */
export function parseAvailabilityGrid(body: unknown): GridSlot[] | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const slots = (body as { slots?: unknown }).slots;
  if (!Array.isArray(slots)) return null;
  const parsed: GridSlot[] = [];
  for (const slot of slots) {
    if (!slot || typeof slot !== "object" || Array.isArray(slot)) return null;
    const row = slot as { start?: unknown; end?: unknown; itemId?: unknown; className?: unknown };
    if (typeof row.start !== "string" || typeof row.end !== "string") return null;
    const itemId = typeof row.itemId === "number" ? row.itemId : typeof row.itemId === "string" ? Number(row.itemId) : NaN;
    if (!Number.isInteger(itemId) || itemId <= 0) return null;
    parsed.push({
      start: row.start,
      end: row.end,
      itemId,
      booked: row.className === LIBCAL_BOOKED_CLASS,
    });
  }
  return parsed;
}

export function bookedByItem(slots: readonly GridSlot[], itemIds: readonly number[]): AvailabilityItem[] {
  const wanted = new Set(itemIds);
  const grouped = new Map<number, BookedInterval[]>();
  for (const itemId of itemIds) grouped.set(itemId, []);
  for (const slot of slots) {
    if (!slot.booked || !wanted.has(slot.itemId)) continue;
    grouped.get(slot.itemId)?.push({ start: slot.start, end: slot.end });
  }
  return itemIds.map((libcalItemId) => ({ libcalItemId, booked: grouped.get(libcalItemId) ?? [] }));
}

export function parseAvailabilityResult(body: unknown): AvailabilityResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { status: "unavailable" };
  if ("status" in body && (body as { status?: unknown }).status === "unavailable") return { status: "unavailable" };
  const items = (body as { items?: unknown }).items;
  if (!Array.isArray(items)) return { status: "unavailable" };
  const parsed: AvailabilityItem[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return { status: "unavailable" };
    const row = item as { libcalItemId?: unknown; booked?: unknown };
    const libcalItemId = typeof row.libcalItemId === "number" ? row.libcalItemId : Number(row.libcalItemId);
    if (!Number.isInteger(libcalItemId) || !Array.isArray(row.booked)) return { status: "unavailable" };
    const booked: BookedInterval[] = [];
    for (const interval of row.booked) {
      if (!interval || typeof interval !== "object" || Array.isArray(interval)) return { status: "unavailable" };
      const span = interval as { start?: unknown; end?: unknown };
      if (typeof span.start !== "string" || typeof span.end !== "string") return { status: "unavailable" };
      booked.push({ start: span.start, end: span.end });
    }
    parsed.push({ libcalItemId, booked });
  }
  return { items: parsed };
}

type CacheEntry = { expires: number; slots: GridSlot[] };
const cache = new Map<string, CacheEntry>();

export function clearLibcalCache(): void {
  cache.clear();
}

async function fetchGrid(
  location: LibcalLocation,
  day: string,
  fetchImpl: typeof fetch,
): Promise<GridSlot[]> {
  const pageUrl = locationPageUrl(location.instance, location.lid, location.kind);
  const page = await fetchImpl(pageUrl, {
    headers: { accept: "text/html", "user-agent": "SootheSpaces/1.0" },
  });
  if (!page.ok) throw new Error(`LibCal location page returned ${page.status}`);
  const groups = parseLibcalGroups(await page.text());
  const wanted = new Set(location.itemIds);
  const matched = groups.filter((group) => wanted.has(group.eid)).map((group) => group.gid);
  const gids = [...new Set(matched.length ? matched : groups.map((group) => group.gid))];
  if (!gids.length) throw new Error("LibCal location has no groups");

  const end = addDays(day, 1);
  const slots: GridSlot[] = [];
  for (const gid of gids) {
    const seen = new Set<number>();
    for (let pageIndex = 0; pageIndex < 5; pageIndex++) {
      const body = new URLSearchParams({
        lid: String(location.lid),
        gid: String(gid),
        eid: "-1",
        seat: location.kind === "seat" ? "1" : "0",
        seatId: "0",
        zone: "0",
        start: day,
        end,
        pageIndex: String(pageIndex),
        pageSize: "100",
      });
      const response = await fetchImpl(availabilityGridUrl(location.instance), {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json",
          referer: pageUrl,
          origin: `https://${location.instance}`,
          "user-agent": "SootheSpaces/1.0",
        },
        body,
      });
      if (!response.ok) throw new Error(`LibCal grid returned ${response.status}`);
      const parsed = parseAvailabilityGrid(await response.json());
      if (!parsed) throw new Error("LibCal grid was not understood");
      const pageItems = new Set(parsed.map((slot) => slot.itemId));
      const freshItems = [...pageItems].filter((itemId) => !seen.has(itemId));
      if (!freshItems.length) break;
      for (const itemId of freshItems) seen.add(itemId);
      const fresh = new Set(freshItems);
      slots.push(...parsed.filter((slot) => fresh.has(slot.itemId)));
      // pageSize counts rooms, not slots. A short page is the last one.
      if (pageItems.size < 100) break;
    }
  }
  return slots;
}

/**
 * Booked slots for the given locations on `day` (YYYY-MM-DD, Detroit).
 * Cached per location for 5 minutes. Any failure is `{ status: "unavailable" }`
 * and is not cached, so the next try can succeed.
 */
export async function loadBookedSlots(
  locations: readonly LibcalLocation[],
  day: string,
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<AvailabilityResult> {
  try {
    const items: AvailabilityItem[] = [];
    for (const location of locations) {
      if (!isLibcalInstance(location.instance)) throw new Error("Unknown LibCal instance");
      const at = now();
      const key = `${location.instance}|${location.lid}|${location.kind}|${day}`;
      const hit = cache.get(key);
      const slots = hit && hit.expires > at ? hit.slots : await fetchGrid(location, day, fetchImpl);
      if (!hit || hit.expires <= at) cache.set(key, { expires: at + CACHE_MS, slots });
      items.push(...bookedByItem(slots, location.itemIds));
    }
    return { items };
  } catch (error) {
    console.error("LibCal availability failed", error);
    return { status: "unavailable" };
  }
}
