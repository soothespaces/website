import assert from "node:assert/strict";
import test from "node:test";
import {
  historyStateWithoutNextKeys,
  hrefWithGroupSize,
  parseGroupSize,
  searchWithGroupSize,
  serializeGroupSize,
  type GroupSize,
} from "./group-size.ts";

test("parseGroupSize reads the people query as a ranking group size", () => {
  assert.equal(parseGroupSize("just-me"), "just_me");
  assert.equal(parseGroupSize("2-3"), "2_3");
  assert.equal(parseGroupSize("4+"), "4_plus");
  // application/x-www-form-urlencoded turns "+" into a space.
  assert.equal(parseGroupSize("4 "), "4_plus");
  assert.equal(parseGroupSize(new URLSearchParams("people=4+").get("people")), "4_plus");
  assert.equal(parseGroupSize(new URLSearchParams("people=4%2B").get("people")), "4_plus");
  assert.equal(parseGroupSize(null), null);
  assert.equal(parseGroupSize(""), null);
  assert.equal(parseGroupSize("solo"), null);
  assert.equal(parseGroupSize("small"), null);
  assert.equal(parseGroupSize("nope"), null);
});

test("serializeGroupSize writes the people query", () => {
  assert.equal(serializeGroupSize("just_me"), "just-me");
  assert.equal(serializeGroupSize("2_3"), "2-3");
  assert.equal(serializeGroupSize("4_plus"), "4+");
  assert.equal(serializeGroupSize(null), null);
});

test("searchWithGroupSize keeps other params and round-trips", () => {
  assert.equal(searchWithGroupSize("", "2_3"), "people=2-3");
  assert.equal(searchWithGroupSize("?people=2-3", "just_me"), "people=just-me");
  assert.equal(searchWithGroupSize("people=2-3", "2_3"), "people=2-3");
  assert.equal(searchWithGroupSize("floor=1&people=2-3", null), "floor=1");
  assert.equal(searchWithGroupSize("people=nope", null), "");
  assert.equal(searchWithGroupSize("floor=1", "4_plus"), "floor=1&people=4%2B");
  assert.equal(searchWithGroupSize("people=4%2B", "4_plus"), "people=4%2B");
  assert.equal(searchWithGroupSize("people=4+", "4_plus"), "people=4%2B");

  const sizes = ["just_me", "2_3", "4_plus"] as const satisfies readonly GroupSize[];
  for (const size of sizes) {
    const search = searchWithGroupSize("building=shapiro", size);
    const params = new URLSearchParams(search);
    assert.equal(parseGroupSize(params.get("people")), size);
    assert.equal(params.get("building"), "shapiro");
    assert.equal(serializeGroupSize(size), params.get("people"));
  }
});

test("hrefWithGroupSize survives a reload", () => {
  const href = hrefWithGroupSize({ pathname: "/map", search: "?floor=1", hash: "#dock" }, "2_3");
  assert.equal(href, "/map?floor=1&people=2-3#dock");
  const url = new URL(href, "https://soothe.test");
  assert.equal(parseGroupSize(url.searchParams.get("people")), "2_3");
  assert.equal(url.searchParams.get("floor"), "1");
  assert.equal(url.hash, "#dock");

  const cleared = hrefWithGroupSize(
    { pathname: "/map", search: "?people=just-me&floor=1", hash: "" },
    null,
  );
  assert.equal(cleared, "/map?floor=1");
  assert.equal(parseGroupSize(new URL(cleared, "https://soothe.test").searchParams.get("people")), null);

  const large = hrefWithGroupSize({ pathname: "/map", search: "", hash: "" }, "4_plus");
  assert.equal(large, "/map?people=4%2B");
  assert.equal(parseGroupSize(new URL(large, "https://soothe.test").searchParams.get("people")), "4_plus");
});

test("historyStateWithoutNextKeys keeps app history keys", () => {
  assert.deepEqual(
    historyStateWithoutNextKeys({
      __NA: true,
      __PRIVATE_NEXTJS_INTERNALS_TREE: { tree: 1 },
      soothePanelStack: [{ kind: "hours" }],
      soothePanelIndex: 2,
    }),
    { soothePanelStack: [{ kind: "hours" }], soothePanelIndex: 2 },
  );
  assert.deepEqual(historyStateWithoutNextKeys(null), {});
  assert.deepEqual(historyStateWithoutNextKeys(undefined), {});
});
