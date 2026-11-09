import assert from "node:assert/strict";
import test from "node:test";
import { matchBuildings } from "./building-matches.ts";

const buildings = [
  { slug: "shapiro", name: "Harold T. and Vivian B. Shapiro Library", shortName: "Shapiro Library" },
  { slug: "hatcher", name: "Hatcher Graduate Library", shortName: null },
  { slug: "dude", name: "Duderstadt Center", shortName: null },
];

test("every word of the query has to match the name or short name", () => {
  assert.deepEqual(matchBuildings("library", buildings).map((b) => b.slug), ["hatcher", "shapiro"]);
  assert.deepEqual(matchBuildings("shapiro lib", buildings).map((b) => b.slug), ["shapiro"]);
  assert.deepEqual(matchBuildings("  ", buildings), []);
  assert.deepEqual(matchBuildings("nothing", buildings), []);
});
