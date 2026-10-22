import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import { detroitParts } from "@/lib/detroit";
import { formatClock, hourTicks, summarizeSlots, type SlotState } from "./slot-times";

export function SlotTimeline({
  start,
  slots,
  showTicks = true,
  slotMinutes = 30,
  summaryId,
  selectable = false,
  starts,
  selectedStart,
  onSelectStart,
}: {
  /** Minutes from midnight. 20 * 60 is 8:00 PM. */
  start: number;
  slots: readonly SlotState[] | null;
  showTicks?: boolean;
  slotMinutes?: number;
  /** Id of the screen-reader summary, so a parent can point at it. */
  summaryId?: string;
  /**
   * One tab stop for the whole timeline. Arrow keys move between free slots.
   * Booked slots are disabled. `starts` are the slot start instants.
   */
  selectable?: boolean;
  starts?: readonly string[];
  selectedStart?: string | null;
  onSelectStart?: (startsAt: string) => void;
}) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  if (slots == null) {
    return <p className="text-sm text-muted-foreground">Availability unavailable</p>;
  }

  const summary = summarizeSlots(start, slots, slotMinutes);
  const ticks = showTicks ? hourTicks(start, slots.length, slotMinutes) : [];
  const span = Math.max(slots.length * slotMinutes, 1);
  const freeIndexes = slots.flatMap((slot, index) => (slot === "free" && starts?.[index] ? [index] : []));
  const selectedIndex = starts?.findIndex((value) => value === selectedStart) ?? -1;
  const tabIndex = selectedIndex >= 0 && slots[selectedIndex] === "free" ? selectedIndex : (freeIndexes[0] ?? -1);

  function move(from: number, direction: 1 | -1) {
    if (!onSelectStart || freeIndexes.length === 0) return;
    const place = freeIndexes.indexOf(from);
    const next = freeIndexes[(place + direction + freeIndexes.length) % freeIndexes.length] ?? freeIndexes[0]!;
    const at = starts?.[next];
    if (!at) return;
    onSelectStart(at);
    buttons.current[next]?.focus();
  }

  return (
    <div>
      <p id={summaryId} className="sr-only">
        {summary}
      </p>
      {selectable ? (
        <div
          role="radiogroup"
          aria-label="Time"
          className="flex flex-wrap gap-1"
          onKeyDown={(event) => {
            if (event.key === "Home" || event.key === "End") {
              event.preventDefault();
              const next = event.key === "Home" ? freeIndexes[0] : freeIndexes.at(-1);
              const at = next == null ? undefined : starts?.[next];
              if (next == null || !at) return;
              onSelectStart?.(at);
              buttons.current[next]?.focus();
              return;
            }
            if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "ArrowDown" && event.key !== "ArrowUp") {
              return;
            }
            event.preventDefault();
            const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
            move(tabIndex, forward ? 1 : -1);
          }}
        >
          {slots.map((slot, index) => {
            const at = starts?.[index];
            const label = at ? formatClock(detroitParts(new Date(at)).minutes) : formatClock(start + index * slotMinutes);
            const free = slot === "free" && !!at;
            return (
              <Button
                key={at ?? index}
                ref={(node) => {
                  buttons.current[index] = node;
                }}
                variant="ghost"
                role="radio"
                aria-checked={free && at === selectedStart}
                aria-disabled={free ? undefined : true}
                disabled={!free}
                tabIndex={index === tabIndex ? 0 : -1}
                aria-label={`${label}, ${free ? "free" : "booked"}`}
                onClick={() => {
                  if (free && at) onSelectStart?.(at);
                }}
                className={cx(
                  "size-6 min-h-6 min-w-6 rounded-sm p-0",
                  slot === "booked" ? "slot-booked bg-destructive hover:bg-destructive" : "slot-free bg-slot-free hover:bg-slot-free",
                  free && at === selectedStart && "ring-2 ring-foreground ring-inset",
                )}
              />
            );
          })}
        </div>
      ) : (
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
      )}
    </div>
  );
}
