export type SlotState = "free" | "booked";

const MINUTES_PER_DAY = 24 * 60;

export function formatClock(minutes: number) {
  const { hour, suffix } = clockParts(minutes);
  return `${hour} ${suffix}`;
}

// "Free 8 to 9 PM, booked 9 to 10 PM, free after 10 PM"
export function summarizeSlots(start: number, slots: readonly SlotState[], slotMinutes = 30) {
  if (!Number.isFinite(start) || !Number.isFinite(slotMinutes) || slotMinutes <= 0) {
    return "Availability unavailable";
  }
  if (slots.length === 0) return "No times in this window";

  const ranges: { state: SlotState; from: number; to: number }[] = [];
  for (let i = 0; i < slots.length; i++) {
    const state: SlotState = slots[i] === "booked" ? "booked" : "free";
    const from = start + i * slotMinutes;
    const to = from + slotMinutes;
    const last = ranges.at(-1);
    if (last && last.state === state) last.to = to;
    else ranges.push({ state, from, to });
  }

  const parts = ranges.map((range, index) => {
    const trailingFree = index === ranges.length - 1 && range.state === "free" && ranges.length > 1;
    if (trailingFree) return `free after ${formatClock(range.from)}`;
    const verb = range.state === "free" ? "free" : "booked";
    return `${verb} ${formatSpan(range.from, range.to)}`;
  });
  const sentence = parts.join(", ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

// Hour marks that land on a block edge, including the start and the end.
export function hourTicks(start: number, slotCount: number, slotMinutes: number) {
  if (!Number.isFinite(start) || slotCount <= 0 || slotMinutes <= 0) return [];
  const end = start + slotCount * slotMinutes;
  const ticks: number[] = [];
  const first = Math.ceil(start / 60) * 60;
  for (let t = first; t <= end; t += 60) {
    if ((t - start) % slotMinutes === 0) ticks.push(t);
  }
  return ticks;
}

function formatSpan(start: number, end: number) {
  const a = clockParts(start);
  const b = clockParts(end);
  if (a.suffix === b.suffix) return `${a.hour} to ${b.hour} ${b.suffix}`;
  return `${a.hour} ${a.suffix} to ${b.hour} ${b.suffix}`;
}

function clockParts(minutes: number) {
  const normalized = ((Math.floor(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const suffix = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 || 12;
  const hour = minute === 0 ? String(hour12) : `${hour12}:${String(minute).padStart(2, "0")}`;
  return { hour, suffix };
}
