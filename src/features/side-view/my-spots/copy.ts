import { daysBetween, detroitParts, monthName, WEEKDAY_NAMES, weekdayOfDate } from "@/lib/detroit";
import type { MonthlyStats } from "@/lib/data/my-history";
import { busynessWord, type PopularTimes } from "@/lib/data/popular-times";
import type { RoomSlot } from "@/lib/data/room-slots";

export type MonthStat = { value: number; label: string };

export type MonthCardModel = {
  title: string;
  empty: string | null;
  stats: MonthStat[];
};

/** The word under a count. 1 is singular ("check-in"); 0 and 2+ are plural. */
export function countWord(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function monthCardModel(stats: MonthlyStats): MonthCardModel {
  // All-time counts (no visit dates yet) must not wear the current month's name.
  const title = stats.thisMonth ? `${stats.month} so far` : "So far";
  if (stats.checkIns === 0) {
    return { title, empty: stats.thisMonth ? "No check-ins yet this month." : "No check-ins yet.", stats: [] };
  }
  const rows: MonthStat[] = [
    { value: stats.checkIns, label: countWord(stats.checkIns, "check-in", "check-ins") },
    { value: stats.spots, label: countWord(stats.spots, "spot", "spots") },
  ];
  // Null means visit dates aren't available yet, so the streak stays off the card.
  if (stats.weeksInARow != null) {
    rows.push({
      value: stats.weeksInARow,
      label: stats.weeksInARow === 1 ? "week in a row" : "weeks in a row",
    });
  }
  return { title, empty: null, stats: rows };
}

/**
 * The board's second clause is "usually quiet" or "usually busy".
 * Not busy and A little busy (0–50) read as quiet; the two busier quarters do not.
 */
export function usualBusyness(times: PopularTimes | null, now: Date): string | null {
  if (!times) return null;
  const parts = detroitParts(now);
  const value = times.busyness[parts.weekday]?.[parts.hour];
  if (value == null) return null;
  const word = busynessWord(value);
  if (!word) return null;
  return word === "Not busy" || word === "A little busy" ? "usually quiet" : "usually busy";
}

/**
 * Bookable rooms whose current status is free. Null when this building has
 * no bookable rooms (use busyness instead) or when availability didn't load.
 */
export function roomsFreeNow(rooms: readonly RoomSlot[]): number | null {
  const bookable = rooms.filter((room) => room.kind === "bookable");
  if (!bookable.length) return null;
  const known = bookable.filter((room) => room.slots != null);
  if (!known.length) return null;
  return known.filter((room) => room.status.startsWith("Free")).length;
}

export function roomsFreeLabel(count: number): string {
  return count === 1 ? "1 room free now" : `${count} rooms free now`;
}

/**
 * Open status from F1.1, phrased the way the rotation row reads, then the
 * busyness or rooms clause. The second clause is omitted when it is missing,
 * and a closed place says when it opens instead of how busy it usually is.
 */
export function rotationStatusLine(input: {
  openStatus: string | null;
  busyness: string | null;
  roomsFree: number | null;
}): string | null {
  const { openStatus, busyness, roomsFree } = input;
  if (openStatus?.startsWith("Opens at ")) {
    return `Closed now · opens ${openStatus.slice("Opens at ".length)}`;
  }
  if (openStatus === "Closed today") return "Closed now";

  let primary: string | null = null;
  if (openStatus === "Open 24 hours") primary = "Open 24 hours";
  else if (openStatus?.startsWith("Open until ")) primary = `Closes ${openStatus.slice("Open until ".length)}`;
  else primary = openStatus;

  const secondary = roomsFree != null ? roomsFreeLabel(roomsFree) : busyness;
  if (primary && secondary) return `${primary} · ${secondary}`;
  return primary ?? secondary;
}

/**
 * "today", "yesterday", "last Tuesday" (a weekday within the past week),
 * "last week", or "in September".
 */
export function lastVisitedPhrase(date: string, now: Date): string {
  const today = detroitParts(now).date;
  const days = daysBetween(date, today);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `last ${WEEKDAY_NAMES[weekdayOfDate(date)]}`;
  if (days < 14) return "last week";
  return `in ${monthName(date)}`;
}

export function visitedMeta(buildingName: string | null, checkIns: number, when: string): string {
  const checks = `${checkIns} ${countWord(checkIns, "check-in", "check-ins")}`;
  const tail = `${checks} · ${when}`;
  return buildingName ? `${buildingName} · ${tail}` : tail;
}
