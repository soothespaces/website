import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { RoomSlot } from "@/lib/data/room-slots";
import { RoomRow } from "./room-row.tsx";
import { RoomsList } from "./rooms-list.tsx";
import { TimelineTicks } from "./timeline-ticks.tsx";

const start = 20 * 60;
const slots = ["free", "free", "free", "free", "booked", "booked", "booked", "booked"] as const;

const bookable: RoomSlot = {
  id: "libcal:umich:2124",
  name: "Room 2124",
  roomNumber: "2124",
  floor: 2,
  capacity: 6,
  kind: "bookable",
  bookingUrl: "https://umich.libcal.com/space/2124",
  slots,
  status: "Free until 10 PM",
};

test("hour ticks for an 8 PM window are 8, 9, 10 and 11 PM", () => {
  const html = renderToStaticMarkup(<TimelineTicks start={start} />);
  for (const label of ["8 PM", "9 PM", "10 PM", "11 PM"]) assert.match(html, new RegExp(label));
  assert.equal(html.includes("12 AM"), false);
});

test("a LibCal row links out and a classroom row does not", () => {
  const linked = renderToStaticMarkup(<RoomRow room={bookable} start={start} />);
  assert.match(linked, /href="https:\/\/umich.libcal.com\/space\/2124"/);
  assert.match(linked, /target="_blank"/);
  assert.match(linked, /rel="noopener noreferrer"/);
  assert.match(linked, /aria-label="Book Room 2124 on LibCal"/);
  assert.match(linked, /Free until 10 PM/);
  assert.match(linked, /text-foreground/);
  assert.equal(/\bavailable\b/i.test(linked), false);

  const booked = renderToStaticMarkup(
    <RoomRow room={{ ...bookable, status: "Booked until 9:30 PM", slots: slots.map(() => "booked") }} start={start} />,
  );
  assert.match(booked, /Booked until 9:30 PM/);
  assert.match(booked, /text-muted-foreground/);

  const down = renderToStaticMarkup(
    <RoomRow room={{ ...bookable, slots: null, status: "Availability unavailable" }} start={start} />,
  );
  assert.match(down, /Availability unavailable/);
  assert.match(down, /<a /);

  const classroom = renderToStaticMarkup(
    <RoomRow
      room={{
        ...bookable,
        id: "class:1400",
        kind: "classroom",
        bookingUrl: undefined,
        status: "Free until 3 PM",
        nextCourse: "EECS 281",
      }}
      start={12 * 60}
    />,
  );
  assert.equal(classroom.includes("<a"), false);
  assert.match(classroom, /Free until 3 PM, then EECS 281/);

  const inClass = renderToStaticMarkup(
    <RoomRow
      room={{
        ...bookable,
        id: "class:2200",
        kind: "classroom",
        bookingUrl: undefined,
        status: "Booked until 4 PM",
        currentCourse: "EECS 370",
      }}
      start={15 * 60}
    />,
  );
  assert.equal(inClass.includes("<a"), false);
  assert.match(inClass, /Class until 4 PM, EECS 370/);
});

test("View on floor plan is present for a planned building and absent without one", () => {
  const eightPm = new Date("2026-10-22T00:00:00Z");
  const withPlan = renderToStaticMarkup(
    <RoomsList
      buildingName="Shapiro Library"
      rooms={[bookable, { ...bookable, id: "libcal:umich:100", name: "Booth 1", floor: 1, capacity: 1 }]}
      loaded
      error={null}
      size="any"
      onSizeChange={() => {}}
      now={eightPm}
      onBack={() => {}}
      planFloors={[1, 2, 3]}
      onViewFloorPlan={() => {}}
    />,
  );
  assert.match(withPlan, /Book a room/);
  assert.match(withPlan, /Shapiro Library/);
  assert.match(withPlan, /Tonight/);
  assert.match(withPlan, /View on floor plan/);
  assert.match(withPlan, /Floor 1/);
  assert.match(withPlan, /Floor 2/);
  assert.match(withPlan, /Tap a room to book it on LibCal/);
  assert.match(withPlan, />Free</);
  assert.match(withPlan, />Booked</);

  const noPlan = renderToStaticMarkup(
    <RoomsList
      buildingName="Some Hall"
      rooms={[bookable]}
      loaded
      error={null}
      size="4_plus"
      onSizeChange={() => {}}
      now={eightPm}
      onBack={() => {}}
      planFloors={[]}
      onViewFloorPlan={() => {}}
    />,
  );
  assert.equal(noPlan.includes("View on floor plan"), false);
  assert.match(noPlan, /Room 2124/);
});
