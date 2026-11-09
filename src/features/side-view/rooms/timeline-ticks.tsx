import { SLOT_COUNT, SLOT_MINUTES } from "@/lib/data/room-slots";
import { formatClock, hourTicks } from "@/components/ui/slot-times";

// Hour labels for one shared timeline, lined up with the slot columns.
// Each label starts at its hour, so "8 PM" doesn't sit on top of "9 PM"
// when the dock is 320px. The closing hour (12 AM after an 8 PM start)
// is left off.
export function TimelineTicks({
  start,
  slotCount = SLOT_COUNT,
  slotMinutes = SLOT_MINUTES,
  every = 1,
}: {
  start: number;
  slotCount?: number;
  slotMinutes?: number;
  /** Label every nth hour, for a narrow column (the rooms map, QA-054). */
  every?: number;
}) {
  const span = Math.max(slotCount * slotMinutes, 1);
  const end = start + span;
  const ticks = hourTicks(start, slotCount, slotMinutes)
    .filter((tick) => tick < end)
    .filter((_, index) => index % every === 0);
  return (
    <div aria-hidden="true" className="relative h-4 min-w-0">
      {ticks.map((tick) => {
        const at = ((tick - start) / span) * 100;
        return (
        <span
          key={tick}
          // A label near the end ends at its hour instead, so it stays inside
          // the column (QA-054).
          className={`absolute top-0 text-xs whitespace-nowrap text-muted-foreground ${at > 80 ? "-translate-x-full" : ""}`}
          style={{ left: `${at}%` }}
        >
          {formatClock(tick)}
        </span>
        );
      })}
    </div>
  );
}
