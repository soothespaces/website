import assert from "node:assert/strict";
import test from "node:test";
import { panelBackLabel } from "./back-label.ts";

test("preferences back names the screen underneath", () => {
  assert.equal(panelBackLabel(undefined), "Home");
  assert.equal(panelBackLabel({ kind: "home" }), "Home");
  assert.equal(
    panelBackLabel({ kind: "building", slug: "shapiro", name: "Shapiro Library" }),
    "Shapiro Library",
  );
  assert.equal(
    panelBackLabel({ kind: "building", slug: "shapiro" }, { building: "Harold T And Vivian B Shapiro Library" }),
    "Harold T And Vivian B Shapiro Library",
  );
  assert.equal(panelBackLabel({ kind: "space", id: "reading-room" }, { space: "Reading Room" }), "Reading Room");
  assert.equal(panelBackLabel({ kind: "photos", slug: "shapiro" }), "Photos");
});
