import assert from "node:assert/strict";
import test from "node:test";
import {
  filterSpaces,
  parseSpaceFilters,
  searchWithSpaceFilters,
  selectableFilters,
  serializeSpaceFilters,
  type FilterableSpace,
} from "./space-filters.ts";

function space(partial: FilterableSpace): FilterableSpace {
  return partial;
}

const quiet = space({ noise_level: "quiet", light_level: "bright", features: [], floor: 1 });
const low = space({ noise_level: "low_noise", light_level: "dim", features: ["computers"], floor: 2 });
const loud = space({
  noise_level: "loud",
  light_level: "moderate",
  features: ["external_monitors"],
  floor: 2,
});
const noFloor = space({ noise_level: "quiet", light_level: "dim", features: ["outlets"], floor: null });

test("parses chip query values and drops anything else", () => {
  assert.deepEqual(parseSpaceFilters("quiet,printer"), ["quiet", "printer"]);
  assert.deepEqual(parseSpaceFilters(" printer , quiet ,quiet,nope"), ["quiet", "printer"]);
  assert.deepEqual(parseSpaceFilters(""), []);
  assert.deepEqual(parseSpaceFilters(null), []);
  assert.deepEqual(parseSpaceFilters("restroom"), ["restroom"]);
  assert.deepEqual(selectableFilters(parseSpaceFilters("quiet,restroom")), ["quiet"]);
  assert.equal(serializeSpaceFilters(["printer", "quiet", "restroom"]), "quiet,printer");
  assert.equal(serializeSpaceFilters([]), null);
});

test("keeps unrelated query params when the filter param changes", () => {
  const next = searchWithSpaceFilters("?people=2-3&panel=spaces&b=shapiro", ["quiet", "printer"]);
  const params = new URLSearchParams(next);
  assert.equal(params.get("people"), "2-3");
  assert.equal(params.get("panel"), "spaces");
  assert.equal(params.get("f"), "quiet,printer");
  assert.equal(searchWithSpaceFilters("?f=quiet&people=just-me", []), "people=just-me");
});

test("quiet, dim and computers match the documented fields", () => {
  const all = [quiet, low, loud, noFloor];
  assert.deepEqual(
    filterSpaces(all, ["quiet"]).map((item) => item.noise_level),
    ["quiet", "low_noise", "quiet"],
  );
  assert.deepEqual(
    filterSpaces(all, ["dim"]).map((item) => item.light_level),
    ["dim", "dim"],
  );
  assert.deepEqual(
    filterSpaces(all, ["computers"]).map((item) => item.features?.[0]),
    ["computers", "external_monitors"],
  );
});

test("printer nearby is the same floor, and a missing floor does not count", () => {
  const all = [quiet, low, loud, noFloor];
  const floors = new Set([2]);
  assert.deepEqual(
    filterSpaces(all, ["printer"], { printerFloors: floors }).map((item) => item.floor),
    [2, 2],
  );
  assert.deepEqual(filterSpaces(all, ["printer"], { printerFloors: new Set() }), []);
  // Loading printers does not hide the list.
  assert.equal(filterSpaces(all, ["printer"], { printerFloors: null }).length, all.length);
});

test("every selected chip has to match", () => {
  const all = [quiet, low, loud, noFloor];
  assert.deepEqual(
    filterSpaces(all, ["quiet", "dim"], { printerFloors: new Set([2]) }).map((item) => item.floor),
    [2, null],
  );
  assert.deepEqual(filterSpaces(all, []), all);
});

test("restroom nearby matches a same-floor point and nothing until those points exist", () => {
  const all = [quiet, low];
  assert.deepEqual(filterSpaces(all, ["restroom"]), all);
  assert.deepEqual(
    filterSpaces(all, ["restroom"], { restroomFloors: new Set([1]) }).map((item) => item.floor),
    [1],
  );
  assert.deepEqual(filterSpaces(all, ["restroom"], { restroomFloors: new Set() }), []);
});
