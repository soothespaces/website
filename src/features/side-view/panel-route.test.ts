import assert from "node:assert/strict";
import test from "node:test";
import {
  backRoute,
  panelHref,
  parsePanelRoute,
  planPush,
  pushRoute,
  reconcileStack,
  resetRoute,
  samePanelRoute,
  serializePanelRoute,
  stackForRoute,
  type PanelRoute,
} from "./panel-route.ts";

const samples: PanelRoute[] = [
  { kind: "home" },
  { kind: "building", slug: "shapiro", recordNumber: "100", name: "Shapiro Library" },
  { kind: "building", slug: null, recordNumber: "100", name: "Some hall" },
  { kind: "hours", slug: "shapiro" },
  { kind: "spaces", slug: "shapiro" },
  { kind: "rooms", slug: "shapiro" },
  { kind: "rooms-map", slug: "shapiro", floor: 2, roomId: "220" },
  { kind: "rooms-map", slug: "shapiro", floor: 0 },
  { kind: "photos", slug: "shapiro", spaceId: "reading-room" },
  { kind: "photos", slug: "shapiro" },
  { kind: "space", id: "reading-room" },
  { kind: "preferences" },
  { kind: "my-spots" },
];

test("panel routes round-trip through the URL and keep unrelated params", () => {
  for (const route of samples) {
    const params = serializePanelRoute(route, new URLSearchParams("people=2-3"));
    assert.equal(params.get("people"), "2-3", panelHref("/map", route, new URLSearchParams()));
    const parsed = parsePanelRoute(params);
    assert.equal(samePanelRoute(parsed, route), true, JSON.stringify(route));
    if (route.kind === "building" && route.name && parsed.kind === "building") {
      assert.equal(parsed.name, route.slug ? undefined : route.name);
    }
  }
});

test("the hours link matches the shared-link shape", () => {
  const href = panelHref("/map", { kind: "hours", slug: "shapiro" }, new URLSearchParams("people=solo"));
  assert.equal(href, "/map?people=solo&panel=hours&b=shapiro");
});

test("a bad panel value is home, and a rooms map without a floor opens rooms", () => {
  assert.deepEqual(parsePanelRoute(new URLSearchParams("panel=nope")), { kind: "home" });
  assert.deepEqual(parsePanelRoute(new URLSearchParams()), { kind: "home" });
  assert.deepEqual(parsePanelRoute(new URLSearchParams("panel=hours")), { kind: "home" });
  assert.deepEqual(parsePanelRoute(new URLSearchParams("panel=rooms-map&b=shapiro&floor=two")), {
    kind: "rooms",
    slug: "shapiro",
  });
});

test("deep links grow the parents Back walks through", () => {
  assert.deepEqual(
    stackForRoute({ kind: "hours", slug: "shapiro" }).map((route) => route.kind),
    ["building", "hours"],
  );
  assert.deepEqual(
    stackForRoute({ kind: "rooms-map", slug: "shapiro", floor: 3 }).map((route) => route.kind),
    ["building", "rooms", "rooms-map"],
  );
  assert.deepEqual(
    stackForRoute({ kind: "photos", slug: "shapiro", spaceId: "reading-room" }).map((route) => route.kind),
    ["building", "space", "photos"],
  );
  assert.deepEqual(stackForRoute({ kind: "preferences" }).map((route) => route.kind), ["home", "preferences"]);
  assert.deepEqual(stackForRoute({ kind: "space", id: "reading-room" }), [{ kind: "space", id: "reading-room" }]);
});

test("push then back returns to the building, and a map reset does not", () => {
  const building: PanelRoute = { kind: "building", slug: "shapiro", name: "Shapiro Library" };
  const hours: PanelRoute = { kind: "hours", slug: "shapiro" };
  const opened = pushRoute([building], hours);
  assert.deepEqual(opened, [building, hours]);
  assert.deepEqual(backRoute(opened), [building]);
  assert.equal(pushRoute(opened, hours), opened);

  const reset = resetRoute({ kind: "building", slug: "ugli" });
  assert.deepEqual(reset, [{ kind: "building", slug: "ugli" }]);
  assert.deepEqual(reconcileStack(opened, building), [building]);
  assert.deepEqual(reconcileStack(opened, { kind: "space", id: "reading-room" }), [
    { kind: "space", id: "reading-room" },
  ]);
});

test("pushing a screen already in the stack pops back to it", () => {
  const building: PanelRoute = { kind: "building", slug: "shapiro", name: "Shapiro Library" };
  const space: PanelRoute = { kind: "space", id: "reading-room" };
  const stack = [building, space];
  assert.deepEqual(pushRoute(stack, building), [building]);
  assert.deepEqual(planPush(stack, building, 1), { type: "back", steps: 1, stack: [building] });
  assert.deepEqual(planPush(stack, building, 0), { type: "replace", stack: [building] });
  assert.deepEqual(planPush(stack, { kind: "hours", slug: "shapiro" }, 1).type, "push");
  assert.equal(planPush(stack, space, 1).type, "none");
});

test("filling in a building's record number does not make it a new route", () => {
  const before: PanelRoute = { kind: "building", slug: "shapiro" };
  const after: PanelRoute = { kind: "building", slug: "shapiro", recordNumber: "100", name: "Shapiro Library" };
  const stack = [before];
  assert.equal(samePanelRoute(before, after), true);
  assert.equal(pushRoute(stack, after), stack);
});
