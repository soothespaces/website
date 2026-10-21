import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  SAMPLE_MS,
  acquireSampler,
  configureLocationStore,
  ensureStarted,
  getSnapshot,
  rememberFix,
  requestFix,
  resetLocationStoreForTests,
} from "./store.ts";

type Listener = () => void;

function harness(initial: PermissionState = "granted") {
  let now = 1_000;
  let calls = 0;
  const timers: { id: number; at: number; fn: () => void }[] = [];
  let nextTimer = 1;
  const windowListeners = new Map<string, Listener[]>();
  const documentListeners = new Map<string, Listener[]>();
  let visibility: DocumentVisibilityState = "visible";
  const status = {
    state: initial,
    onchange: null as (() => void) | null,
  };
  let release: ((position: { coords: { latitude: number; longitude: number; accuracy: number } }) => void) | null = null;
  let auto = true;

  function list(map: Map<string, Listener[]>, type: string) {
    const found = map.get(type) ?? [];
    map.set(type, found);
    return found;
  }

  const envWindow = {
    addEventListener(type: string, listener: Listener) {
      list(windowListeners, type).push(listener);
    },
    removeEventListener(type: string, listener: Listener) {
      const found = list(windowListeners, type).filter((item) => item !== listener);
      windowListeners.set(type, found);
    },
    dispatch(type: string) {
      for (const listener of [...(windowListeners.get(type) ?? [])]) listener();
    },
  };

  const envDocument = {
    get visibilityState() {
      return visibility;
    },
    addEventListener(type: string, listener: Listener) {
      list(documentListeners, type).push(listener);
    },
    removeEventListener(type: string, listener: Listener) {
      const found = list(documentListeners, type).filter((item) => item !== listener);
      documentListeners.set(type, found);
    },
    setVisibility(next: DocumentVisibilityState) {
      visibility = next;
      for (const listener of [...(documentListeners.get("visibilitychange") ?? [])]) listener();
    },
  };

  configureLocationStore({
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = nextTimer;
      nextTimer += 1;
      timers.push({ id, at: now + ms, fn });
      return id;
    },
    clearTimeout: (id) => {
      const index = timers.findIndex((timer) => timer.id === id);
      if (index >= 0) timers.splice(index, 1);
    },
    window: envWindow,
    document: envDocument,
    permissions: {
      query: async () => status,
    },
    geolocation: {
      getCurrentPosition: (success) => {
        calls += 1;
        const position = { coords: { latitude: 42.2756, longitude: -83.7372, accuracy: 8 } };
        if (auto) queueMicrotask(() => success(position));
        else release = success;
      },
    },
  });

  return {
    status,
    window: envWindow,
    document: envDocument,
    calls: () => calls,
    hold() {
      auto = false;
    },
    finish() {
      release?.({ coords: { latitude: 42.2756, longitude: -83.7372, accuracy: 8 } });
      release = null;
      auto = true;
    },
    async advance(ms: number) {
      now += ms;
      for (let guard = 0; guard < 10; guard += 1) {
        const due = timers.filter((timer) => timer.at <= now).sort((a, b) => a.at - b.at);
        if (!due.length) break;
        for (const timer of due) {
          const index = timers.indexOf(timer);
          if (index >= 0) timers.splice(index, 1);
          timer.fn();
        }
        await Promise.resolve();
        await Promise.resolve();
      }
    },
  };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("location store", () => {
  afterEach(() => {
    resetLocationStoreForTests();
  });

  it("does not read before the visitor interacts, even when permission is granted", async () => {
    const fake = harness("granted");
    await ensureStarted();
    acquireSampler();
    await flush();
    assert.equal(fake.calls(), 0);
    assert.equal(getSnapshot().permission, "granted");
    assert.equal(getSnapshot().fix, null);
  });

  it("reads at once when armed and granted, then again after 20 seconds", async () => {
    const fake = harness("granted");
    await ensureStarted();
    acquireSampler();
    fake.window.dispatch("pointerdown");
    await flush();
    assert.equal(fake.calls(), 1);
    assert.equal(getSnapshot().fix?.latitude, 42.2756);
    await fake.advance(SAMPLE_MS - 1);
    assert.equal(fake.calls(), 1);
    await fake.advance(1);
    await flush();
    assert.equal(fake.calls(), 2);
  });

  it("pauses while the tab is hidden and reads immediately when it returns", async () => {
    const fake = harness("granted");
    await ensureStarted();
    acquireSampler();
    fake.window.dispatch("pointerdown");
    await flush();
    assert.equal(fake.calls(), 1);
    fake.document.setVisibility("hidden");
    await fake.advance(SAMPLE_MS);
    assert.equal(fake.calls(), 1);
    fake.document.setVisibility("visible");
    await flush();
    assert.equal(fake.calls(), 2);
  });

  it("starts sampling when permission changes to granted, without a remount", async () => {
    const fake = harness("prompt");
    await ensureStarted();
    acquireSampler();
    fake.window.dispatch("keydown");
    await flush();
    assert.equal(fake.calls(), 0);
    fake.status.state = "granted";
    fake.status.onchange?.();
    await flush();
    assert.equal(fake.calls(), 1);
  });

  it("shares one read per tick across two samplers", async () => {
    const fake = harness("granted");
    await ensureStarted();
    const stopA = acquireSampler();
    const stopB = acquireSampler();
    fake.window.dispatch("wheel");
    await flush();
    assert.equal(fake.calls(), 1);
    await fake.advance(SAMPLE_MS);
    await flush();
    assert.equal(fake.calls(), 2);
    stopA();
    stopB();
    await fake.advance(SAMPLE_MS);
    assert.equal(fake.calls(), 2);
  });

  it("clears the fix when permission is denied", async () => {
    const fake = harness("granted");
    await ensureStarted();
    acquireSampler();
    fake.window.dispatch("pointerdown");
    await flush();
    assert.ok(getSnapshot().fix);
    fake.status.state = "denied";
    fake.status.onchange?.();
    assert.equal(getSnapshot().permission, "denied");
    assert.equal(getSnapshot().fix, null);
    await fake.advance(SAMPLE_MS);
    assert.equal(fake.calls(), 1);
  });

  it("shares one getCurrentPosition across concurrent requestFix calls", async () => {
    const fake = harness("prompt");
    fake.hold();
    await ensureStarted();
    const first = requestFix();
    const second = requestFix();
    assert.equal(fake.calls(), 1);
    fake.finish();
    const [a, b] = await Promise.all([first, second]);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(fake.calls(), 1);
  });

  it("shares a fix from the map's locate button without reading again", async () => {
    const fake = harness("prompt");
    await ensureStarted();
    rememberFix({ latitude: 42.29, longitude: -83.71 }, 12);
    assert.equal(getSnapshot().permission, "granted");
    assert.equal(getSnapshot().fix?.latitude, 42.29);
    assert.equal(getSnapshot().fix?.accuracy, 12);
    assert.equal(fake.calls(), 0);
  });
});
