import assert from "node:assert/strict";
import test from "node:test";
import { groupPrintersByFloor, printersOnFloor, type Printer } from "./printers.ts";

function printer(id: number, floor: number | null): Printer {
  return {
    id,
    buildingSlug: "harold-t-and-vivian-b-shapiro-library",
    floor,
    floorLabel: floor == null ? null : `Floor ${floor}`,
    roomNumber: String(2000 + id),
    displayName: `Printer ${id}`,
    color: false,
    cardReader: true,
    floorMap: "shapiro-2",
    floorMapX: 10,
    floorMapY: 20,
  };
}

test("printers group and filter by floor", () => {
  const printers = [printer(1, 2), printer(2, 2), printer(3, 1), printer(4, null)];
  assert.deepEqual(
    printersOnFloor(printers, 2).map((item) => item.id),
    [1, 2],
  );
  assert.deepEqual(printersOnFloor(printers, 4), []);
  const byFloor = groupPrintersByFloor(printers);
  assert.deepEqual([...(byFloor.get(2) ?? [])].map((item) => item.id), [1, 2]);
  assert.deepEqual([...byFloor.keys()], [2, 1]);
});
