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
}: {
  start: number;
  slotCount?: number;
  slotMinutes?: number;
}) {
  const span = Math.max(slotCount * slotMinutes, 1);
  const end = start + span;
  const ticks = hourTicks(start, slotCount, slotMinutes).filter((tick) => tick < end);
  return (
    <div aria-hidden="true" className="relative h-4 min-w-0">
      {ticks.map((tick) => (
        <span
          key={tick}
          className="absolute top-0 text-xs whitespace-nowrap text-muted-foreground"
          style={{ left: `${((tick - start) / span) * 100}%` }}
        >
          {formatClock(tick)}
        </span>
      ))}
    </div>
  );
}
