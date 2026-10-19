// Campus hours, popular times and room slots are all America/Detroit local
// time. Postgres `time` columns have no offset, and LibCal slots don't either.

export const DETROIT = "America/Detroit";

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export type DetroitParts = {
  year: number;
  month: number;
  day: number;
  /** 0 = Sunday, matching opening_hours and extract(dow). */
  weekday: number;
  hour: number;
  minute: number;
  /** YYYY-MM-DD in Detroit. */
  date: string;
  /** Minutes from local midnight. */
  minutes: number;
};

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: DETROIT,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function detroitParts(now: Date): DetroitParts {
  const parts = formatter.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  let hour = Number(get("hour"));
  const minute = Number(get("minute"));
  if (hour === 24) hour = 0;
  const weekday = WEEKDAY_INDEX[get("weekday")] ?? 0;
  const date = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { year, month, day, weekday, hour, minute, date, minutes: hour * 60 + minute };
}

/** "8 PM", "8:30 PM", "12 AM". 1440 minutes (24:00) is midnight, "12 AM". */
export function formatClock(minutes: number): string {
  const minuteOfDay = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  let hour = Math.floor(minuteOfDay / 60);
  const mins = minuteOfDay % 60;
  const suffix = hour >= 12 ? "PM" : "AM";
  hour %= 12;
  if (hour === 0) hour = 12;
  return mins === 0 ? `${hour} ${suffix}` : `${hour}:${String(mins).padStart(2, "0")} ${suffix}`;
}

export function weekdayOfDate(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/** Whole days from `from` to `until`. Negative when `until` is earlier. */
export function daysBetween(from: string, until: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${until}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

export function monthName(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year!, month! - 1, day)));
}
