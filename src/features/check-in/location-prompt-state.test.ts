import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LOCATION_DISMISS_MS,
  dismissLocationPrompt,
  readDismissedUntil,
  readLocationDenied,
  readShownThisVisit,
  rememberLocationDenied,
  rememberShownThisVisit,
  shouldShowLocationPrompt,
} from "./location-prompt-state.ts";

function memory() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

const ready = {
  permission: "prompt" as const,
  now: 1_000,
  dismissedUntil: null,
  deniedForever: false,
  shownThisVisit: false,
  ready: true,
};

describe("location pre-prompt (K1 / SOS-136)", () => {
  it("stays hidden until the map has been on screen", () => {
    assert.equal(shouldShowLocationPrompt({ ...ready, ready: false }), false);
    assert.equal(shouldShowLocationPrompt(ready), true);
  });

  it("shows for prompt and unknown, and not once location is decided", () => {
    assert.equal(shouldShowLocationPrompt({ ...ready, permission: "unknown" }), true);
    assert.equal(shouldShowLocationPrompt({ ...ready, permission: "granted" }), false);
    assert.equal(shouldShowLocationPrompt({ ...ready, permission: "denied" }), false);
  });

  it("hides for a week after Not now, then can show again", () => {
    const storage = memory();
    dismissLocationPrompt(1_000, storage);
    const until = readDismissedUntil(storage);
    assert.equal(until, 1_000 + LOCATION_DISMISS_MS);
    assert.equal(shouldShowLocationPrompt({ ...ready, now: until! - 1, dismissedUntil: until }), false);
    assert.equal(shouldShowLocationPrompt({ ...ready, now: until!, dismissedUntil: until }), true);
  });

  it("remembers a denial and a visit", () => {
    const storage = memory();
    assert.equal(readLocationDenied(storage), false);
    rememberLocationDenied(storage);
    assert.equal(readLocationDenied(storage), true);
    assert.equal(shouldShowLocationPrompt({ ...ready, deniedForever: true }), false);

    assert.equal(readShownThisVisit(storage), false);
    rememberShownThisVisit(storage);
    assert.equal(readShownThisVisit(storage), true);
    assert.equal(shouldShowLocationPrompt({ ...ready, shownThisVisit: true }), false);
  });

  it("ignores storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    assert.equal(readDismissedUntil(broken), null);
    assert.equal(readLocationDenied(broken), false);
    assert.equal(readShownThisVisit(broken), false);
    assert.doesNotThrow(() => dismissLocationPrompt(0, broken));
    assert.doesNotThrow(() => rememberLocationDenied(broken));
    assert.doesNotThrow(() => rememberShownThisVisit(broken));
  });
});
