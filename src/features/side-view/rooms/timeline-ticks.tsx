import { cx } from "@/lib/cx";
import { SLOT_COUNT, SLOT_MINUTES } from "@/lib/data/room-slots";
import { formatClock, hourTicks } from "@/components/ui/slot-times";

// Hour labels for one shared timeline, lined up with the slot columns.
// The closing hour (12 AM after an 8 PM start) is left off so the row
// reads 8 PM, 9 PM, 10 PM, 11 PM.
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
      {ticks.map((tick) => {
        const left = ((tick - start) / span) * 100;
        return (
          <span
            key={tick}
            className={cx(
              "absolute top-0 text-xs whitespace-nowrap text-muted-foreground",
              left <= 0 ? "" : "-translate-x-1/2",
            )}
            style={{ left: `${left}%` }}
          >
            {formatClock(tick)}
          </span>
        );
      })}
    </div>
  );
}
