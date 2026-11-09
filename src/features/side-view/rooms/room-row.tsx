import { useId } from "react";
import { SlotTimeline } from "@/components/ui/slot-timeline";
import { cx } from "@/lib/cx";
import type { RoomSlot } from "@/lib/data/room-slots";
import { roomTitle } from "@/features/side-view/rooms-map/room-copy";
import { roomColumns } from "./room-list";
import { roomBookingLabel, roomIsBookableLink, roomStatusLine } from "./room-status";

const rowClass = cx(roomColumns, "items-center py-3 text-left");

export function RoomRow({
  room,
  start,
  onFocus,
  onBook,
}: {
  room: RoomSlot;
  start: number;
  onFocus?: () => void;
  /** Called when the LibCal link opens, so the check-in prompt can follow (SOS-161). */
  onBook?: () => void;
}) {
  const status = roomStatusLine(room);
  // "Room 2124", "Booth 1": the short name the rooms map uses, not LibCal's
  // full title (QA-049).
  const title = roomTitle(room);
  const statusId = useId();
  const summaryId = useId();
  const describedBy = room.slots == null ? statusId : `${statusId} ${summaryId}`;
  const body = (
    <>
      <span className="min-w-0">
        <span className="block font-semibold break-words">{title}</span>
        <span
          id={statusId}
          className={cx(
            "block text-sm break-words",
            status.tone === "free" ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {/* "12 AM" stays on one line (DA-03). */}
          {status.text.replace(/ (AM|PM)\b/g, "\u00a0$1")}
        </span>
      </span>
      <span className="min-w-0">
        {room.slots == null ? null : (
          <SlotTimeline start={start} slots={room.slots} showTicks={false} summaryId={summaryId} />
        )}
      </span>
    </>
  );

  if (roomIsBookableLink(room)) {
    return (
      <a
        href={room.bookingUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={roomBookingLabel(title)}
        aria-describedby={describedBy}
        className={cx(rowClass, "rounded-md hover:bg-accent")}
        onFocus={onFocus}
        onClick={onBook}
      >
        {body}
      </a>
    );
  }

  return <div className={rowClass}>{body}</div>;
}
