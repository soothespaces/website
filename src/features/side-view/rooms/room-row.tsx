import { useId } from "react";
import { SlotTimeline } from "@/components/ui/slot-timeline";
import { cx } from "@/lib/cx";
import type { RoomSlot } from "@/lib/data/room-slots";
import { roomColumns } from "./room-list";
import { roomBookingLabel, roomIsBookableLink, roomStatusLine } from "./room-status";

const rowClass = cx(roomColumns, "items-center py-3 text-left");

export function RoomRow({ room, start, onFocus }: { room: RoomSlot; start: number; onFocus?: () => void }) {
  const status = roomStatusLine(room);
  const statusId = useId();
  const summaryId = useId();
  const describedBy = room.slots == null ? statusId : `${statusId} ${summaryId}`;
  const body = (
    <>
      <span className="min-w-0">
        <span className="block font-semibold break-words">{room.name}</span>
        <span
          id={statusId}
          className={cx(
            "block text-sm break-words",
            status.tone === "free" ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {status.text}
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
        aria-label={roomBookingLabel(room.name)}
        aria-describedby={describedBy}
        className={cx(rowClass, "rounded-md hover:bg-accent")}
        onFocus={onFocus}
      >
        {body}
      </a>
    );
  }

  return <div className={rowClass}>{body}</div>;
}
