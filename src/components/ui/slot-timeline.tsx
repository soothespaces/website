import { cx } from "@/lib/cx";
import { formatClock, hourTicks, summarizeSlots, type SlotState } from "./slot-times";

export function SlotTimeline({
  start,
  slots,
  showTicks = true,
  slotMinutes = 30,
  summaryId,
}: {
  /** Minutes from midnight. 20 * 60 is 8:00 PM. */
  start: number;
  slots: readonly SlotState[] | null;
  showTicks?: boolean;
  slotMinutes?: number;
  /** Id of the screen-reader summary, so a parent can point at it. */
  summaryId?: string;
}) {
  if (slots == null) {
    return <p className="text-sm text-muted-foreground">Availability unavailable</p>;
  }

  const summary = summarizeSlots(start, slots, slotMinutes);
  const ticks = showTicks ? hourTicks(start, slots.length, slotMinutes) : [];
  const span = Math.max(slots.length * slotMinutes, 1);

  return (
    <div>
      <p id={summaryId} className="sr-only">
        {summary}
      </p>
      <div aria-hidden="true">
        {ticks.length > 0 ? (
          <div className="relative mb-1 h-4">
            {ticks.map((tick, index) => (
              <span
                key={tick}
                className={cx(
                  "absolute top-0 text-xs whitespace-nowrap text-muted-foreground",
                  index === 0 ? "" : index === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2",
                )}
                style={{ left: `${((tick - start) / span) * 100}%` }}
              >
                {formatClock(tick)}
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex gap-0.5 overflow-hidden rounded-full">
          {slots.map((slot, index) => (
            <div
              key={index}
              className={cx(
                "h-3.5 min-w-1 flex-1",
                slot === "booked" ? "slot-booked bg-destructive" : "slot-free bg-slot-free",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
