import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import { formatClock, hourTicks, summarizeSlots, type SlotState } from "./slot-times";

export function SlotTimeline({
  start,
  slots,
  showTicks = true,
  slotMinutes = 30,
  selectedSlot,
  onSlotSelect,
}: {
  /** Minutes from midnight. 20 * 60 is 8:00 PM. */
  start: number;
  slots: readonly SlotState[] | null;
  showTicks?: boolean;
  slotMinutes?: number;
  /** Half-hour the Book action will record, when slots can be chosen. */
  selectedSlot?: number;
  onSlotSelect?: (index: number) => void;
}) {
  if (slots == null) {
    return <p className="text-sm text-muted-foreground">Availability unavailable</p>;
  }

  const summary = summarizeSlots(start, slots, slotMinutes);
  const ticks = showTicks ? hourTicks(start, slots.length, slotMinutes) : [];
  const span = Math.max(slots.length * slotMinutes, 1);

  return (
    <div>
      {onSlotSelect ? null : <p className="sr-only">{summary}</p>}
      <div aria-hidden={onSlotSelect ? undefined : true}>
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
          {slots.map((slot, index) => {
            const paint = cx(
              "h-3.5 min-w-1 flex-1",
              slot === "booked" ? "slot-booked bg-destructive" : "slot-free bg-slot-free",
              onSlotSelect && selectedSlot === index && "ring-2 ring-foreground ring-inset",
            );
            if (!onSlotSelect) return <div key={index} className={paint} />;
            const at = start + index * slotMinutes;
            return (
              <Button
                key={index}
                variant="ghost"
                aria-pressed={selectedSlot === index}
                aria-label={`${formatClock(at)}, ${slot === "booked" ? "booked" : "free"}`}
                onClick={() => onSlotSelect(index)}
                className={cx(paint, "min-h-0 rounded-none p-0 hover:bg-transparent")}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
