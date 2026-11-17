import assert from "node:assert/strict";
import test from "node:test";
import {
  DOCK_DEFAULT_PX,
  DOCK_DEFAULT_WIDE_PX,
  DOCK_MAX_PX,
  DOCK_MIN_PX,
  clampDockWidth,
  defaultDockWidth,
  dockMaxPx,
  dockWidthAfterKey,
  readStoredDockWidth,
} from "./dock-width.ts";

test("default dock width matches the old fixed columns", () => {
  assert.equal(defaultDockWidth(768), DOCK_DEFAULT_PX);
  assert.equal(defaultDockWidth(1023), DOCK_DEFAULT_PX);
  assert.equal(defaultDockWidth(1024), DOCK_DEFAULT_WIDE_PX);
  assert.equal(defaultDockWidth(1440), DOCK_DEFAULT_WIDE_PX);
});

test("dock width stays between the minimum and the room left for the map", () => {
  assert.equal(dockMaxPx(1280), DOCK_MAX_PX);
  assert.equal(dockMaxPx(768), 448);
  assert.equal(clampDockWidth(200, 1280), DOCK_MIN_PX);
  assert.equal(clampDockWidth(900, 1280), DOCK_MAX_PX);
  assert.equal(clampDockWidth(500, 768), 448);
  assert.equal(clampDockWidth(400.4, 1280), 400);
});

test("stored dock width falls back when it is missing or not a number", () => {
  assert.equal(readStoredDockWidth(null, 1280), DOCK_DEFAULT_WIDE_PX);
  assert.equal(readStoredDockWidth("", 800), DOCK_DEFAULT_PX);
  assert.equal(readStoredDockWidth("nope", 1280), DOCK_DEFAULT_WIDE_PX);
  assert.equal(readStoredDockWidth("480", 1280), 480);
  assert.equal(readStoredDockWidth("9999", 1280), DOCK_MAX_PX);
});

test("arrow keys nudge the dock and Home and End jump to the ends", () => {
  assert.equal(dockWidthAfterKey(400, "ArrowRight", false, 1280), 416);
  assert.equal(dockWidthAfterKey(400, "ArrowLeft", false, 1280), 384);
  assert.equal(dockWidthAfterKey(400, "ArrowRight", true, 1280), 464);
  assert.equal(dockWidthAfterKey(400, "Home", false, 1280), DOCK_MIN_PX);
  assert.equal(dockWidthAfterKey(400, "End", false, 1280), DOCK_MAX_PX);
  assert.equal(dockWidthAfterKey(400, "End", false, 768), 448);
  assert.equal(dockWidthAfterKey(400, "Enter", false, 1280), null);
});
