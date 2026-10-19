import assert from "node:assert/strict";
import test from "node:test";
import {
  bookedByItem,
  clearLibcalCache,
  loadBookedSlots,
  parseAvailabilityGrid,
  parseAvailabilityResult,
  parseLibcalGroups,
  type LibcalLocation,
} from "./libcal.ts";
import gridFixture from "./libcal-grid.fixture.json" with { type: "json" };

const location: LibcalLocation = {
  instance: "umich.libcal.com",
  lid: 2761,
  kind: "space",
  itemIds: [27511, 22733],
};

const pageHtml = `
resources.push({
  eid: 27511,
  gid: 5040,
  lid: 2761,
  title: "2nd Floor - 2122"
});
resources.push({
  eid: 22733,
  gid: 5040,
  lid: 2761
});
`;

test("a grid keeps booked ranges and drops checksums", () => {
  const slots = parseAvailabilityGrid(gridFixture);
  assert.ok(slots);
  const items = bookedByItem(slots, [27511, 22733]);
  assert.equal(items[0]?.libcalItemId, 27511);
  assert.deepEqual(items[0]?.booked, [
    { start: "2026-10-21 20:00:00", end: "2026-10-21 20:30:00" },
    { start: "2026-10-21 20:30:00", end: "2026-10-21 21:00:00" },
  ]);
  assert.deepEqual(items[1]?.booked, []);
  assert.equal(JSON.stringify(items).includes("checksum"), false);
  assert.equal(JSON.stringify(items).includes("do-not-keep"), false);
  assert.equal(parseAvailabilityGrid({ slots: "nope" }), null);
  assert.equal(parseAvailabilityGrid({ slots: [{ start: "2026-10-21 20:00:00", end: "2026-10-21 20:30:00" }] }), null);
});

test("groups come from the location page, ignoring gid 0", () => {
  assert.deepEqual(parseLibcalGroups(`${pageHtml}\nresources.push({ eid: 1, gid: 0 });`), [
    { eid: 27511, gid: 5040 },
    { eid: 22733, gid: 5040 },
  ]);
});

test("a fetch failure is unavailable and is not cached", async () => {
  clearLibcalCache();
  let calls = 0;
  const failing: typeof fetch = async () => {
    calls += 1;
    throw new Error("network down");
  };
  const failed = await loadBookedSlots([location], "2026-10-21", failing, () => 0);
  assert.deepEqual(failed, { status: "unavailable" });

  const fetchImpl: typeof fetch = async (input) => {
    calls += 1;
    const url = String(input);
    if (url.includes("availability/grid")) {
      return new Response(JSON.stringify(gridFixture), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(pageHtml, { status: 200 });
  };
  const ok = await loadBookedSlots([location], "2026-10-21", fetchImpl, () => 0);
  assert.equal("items" in ok && ok.items[0]?.booked.length, 2);
  const callsAfterFirst = calls;
  const again = await loadBookedSlots([location], "2026-10-21", fetchImpl, () => 1_000);
  assert.deepEqual(again, ok);
  assert.equal(calls, callsAfterFirst);

  const later = await loadBookedSlots([location], "2026-10-21", fetchImpl, () => 5 * 60 * 1000 + 1);
  assert.equal("items" in later, true);
  assert.ok(calls > callsAfterFirst);
  clearLibcalCache();
});

test("the route body parses, and a bad body is unavailable", () => {
  assert.deepEqual(parseAvailabilityResult({ status: "unavailable" }), { status: "unavailable" });
  assert.deepEqual(parseAvailabilityResult({ items: [{ libcalItemId: 27511, booked: [{ start: "2026-10-21 20:00:00", end: "2026-10-21 20:30:00" }] }] }), {
    items: [{ libcalItemId: 27511, booked: [{ start: "2026-10-21 20:00:00", end: "2026-10-21 20:30:00" }] }],
  });
  assert.deepEqual(parseAvailabilityResult({ items: [{}] }), { status: "unavailable" });
  assert.deepEqual(parseAvailabilityResult(null), { status: "unavailable" });
});
