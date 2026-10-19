import assert from "node:assert/strict";
import test from "node:test";
import {
  hrefWithGroupSize,
  parseGroupSize,
  searchWithGroupSize,
  serializeGroupSize,
  type GroupSize,
} from "./group-size.ts";

test("parseGroupSize reads the people query", () => {
  assert.equal(parseGroupSize("just-me"), "solo");
  assert.equal(parseGroupSize("2-3"), "small");
  assert.equal(parseGroupSize("4+"), "large");
  // application/x-www-form-urlencoded turns "+" into a space.
  assert.equal(parseGroupSize("4 "), "large");
  assert.equal(parseGroupSize(new URLSearchParams("people=4+").get("people")), "large");
  assert.equal(parseGroupSize(new URLSearchParams("people=4%2B").get("people")), "large");
  assert.equal(parseGroupSize(null), null);
  assert.equal(parseGroupSize(""), null);
  assert.equal(parseGroupSize("solo"), null);
  assert.equal(parseGroupSize("nope"), null);
});

test("serializeGroupSize writes the people query", () => {
  assert.equal(serializeGroupSize("solo"), "just-me");
  assert.equal(serializeGroupSize("small"), "2-3");
  assert.equal(serializeGroupSize("large"), "4+");
  assert.equal(serializeGroupSize(null), null);
});

test("searchWithGroupSize keeps other params and round-trips", () => {
  assert.equal(searchWithGroupSize("", "small"), "people=2-3");
  assert.equal(searchWithGroupSize("?people=2-3", "solo"), "people=just-me");
  assert.equal(searchWithGroupSize("people=2-3", "small"), "people=2-3");
  assert.equal(searchWithGroupSize("floor=1&people=2-3", null), "floor=1");
  assert.equal(searchWithGroupSize("people=nope", null), "");
  assert.equal(searchWithGroupSize("floor=1", "large"), "floor=1&people=4%2B");
  assert.equal(searchWithGroupSize("people=4%2B", "large"), "people=4%2B");
  assert.equal(searchWithGroupSize("people=4+", "large"), "people=4%2B");

  const sizes = ["solo", "small", "large"] as const satisfies readonly GroupSize[];
  for (const size of sizes) {
    const search = searchWithGroupSize("building=shapiro", size);
    const params = new URLSearchParams(search);
    assert.equal(parseGroupSize(params.get("people")), size);
    assert.equal(params.get("building"), "shapiro");
    assert.equal(serializeGroupSize(size), params.get("people"));
  }
});

test("hrefWithGroupSize survives a reload", () => {
  const href = hrefWithGroupSize({ pathname: "/map", search: "?floor=1", hash: "#dock" }, "small");
  assert.equal(href, "/map?floor=1&people=2-3#dock");
  const url = new URL(href, "https://soothe.test");
  assert.equal(parseGroupSize(url.searchParams.get("people")), "small");
  assert.equal(url.searchParams.get("floor"), "1");
  assert.equal(url.hash, "#dock");

  const cleared = hrefWithGroupSize(
    { pathname: "/map", search: "?people=just-me&floor=1", hash: "" },
    null,
  );
  assert.equal(cleared, "/map?floor=1");
  assert.equal(parseGroupSize(new URL(cleared, "https://soothe.test").searchParams.get("people")), null);

  const large = hrefWithGroupSize({ pathname: "/map", search: "", hash: "" }, "large");
  assert.equal(large, "/map?people=4%2B");
  assert.equal(parseGroupSize(new URL(large, "https://soothe.test").searchParams.get("people")), "large");
});
