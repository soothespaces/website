import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {
  DEFAULT_SETTINGS,
  SETTINGS_BOOT_SCRIPT,
  SETTINGS_STORAGE_KEY,
  THEME_STORAGE_KEY,
  applyDisplayAttributes,
  displayAttributes,
  parseSettings,
  readStoredSettings,
  writeStoredSettings,
} from "./model.ts";

const samples = [
  DEFAULT_SETTINGS,
  {
    theme: "dark",
    contrast: "more",
    text: 112.5,
    motion: "reduce",
    defaultView: "list",
    palette: "cvd",
    needs: { noise: ["quiet"] },
  },
  {
    theme: "light",
    contrast: "normal",
    text: 150,
    motion: "system",
    defaultView: "map",
  },
  {
    theme: "system",
    contrast: "system",
    text: 125,
    motion: "system",
    defaultView: "map",
    palette: "default",
  },
] as const;

test("parseSettings keeps known fields and preserves later keys", () => {
  const parsed = parseSettings({
    theme: "dark",
    contrast: "nope",
    text: 125,
    motion: "reduce",
    defaultView: "list",
    palette: "cvd",
    needs: { features: ["wheelchair_accessible"] },
    themeNote: "ignore me? no, keep unknown",
  });

  assert.equal(parsed.settings.theme, "dark");
  assert.equal(parsed.settings.contrast, "system");
  assert.equal(parsed.settings.text, 125);
  assert.equal(parsed.settings.motion, "reduce");
  assert.equal(parsed.settings.defaultView, "list");
  assert.equal(parsed.extras.palette, "cvd");
  assert.deepEqual(parsed.extras.needs, { features: ["wheelchair_accessible"] });
  assert.equal(parsed.extras.themeNote, "ignore me? no, keep unknown");
  assert.equal("contrast" in parsed.extras, false);
});

test("parseSettings falls back when the document is unusable", () => {
  assert.deepEqual(parseSettings(null).settings, DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings("dark").settings, DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings([]).settings, DEFAULT_SETTINGS);
});

test("text size 112.5 is stored as 112.5 and applied as 112", () => {
  const { settings } = parseSettings({ text: 112.5 });
  assert.equal(settings.text, 112.5);
  const large = displayAttributes(settings, {});
  const base = displayAttributes({ ...settings, text: 100 }, {});
  assert.equal(large["data-text"], "112");
  assert.equal(base["data-text"], null);
});

test("boot script matches applyDisplayAttributes", () => {
  for (const sample of samples) {
    const { settings, extras } = parseSettings(sample);
    const fromApply = new Map<string, string>();
    applyDisplayAttributes(settings, extras, {
      setAttribute: (name, value) => fromApply.set(name, value),
      removeAttribute: (name) => fromApply.delete(name),
    });

    const fromBoot = runBoot(sample);
    assert.deepEqual(
      Object.fromEntries(fromBoot.attrs),
      Object.fromEntries(fromApply),
      JSON.stringify(sample),
    );
    assert.equal(fromBoot.themeKey, settings.theme);
  }
});

test("boot script ignores corrupt storage", () => {
  const result = runBootRaw("not-json");
  assert.equal(result.attrs.size, 0);
  assert.equal(result.themeKey, null);
});

test("localStorage round-trip keeps extras and the theme key", () => {
  const store = new Map<string, string>();
  const previousWindow = globalThis.window;
  const previousStorage = globalThis.localStorage;
  globalThis.window = globalThis as unknown as Window & typeof globalThis;
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };

  try {
    const { settings, extras } = parseSettings(samples[1]);
    assert.equal(writeStoredSettings(settings, extras), true);
    assert.equal(store.get(THEME_STORAGE_KEY), "dark");
    const read = readStoredSettings();
    assert.deepEqual(read.settings, settings);
    assert.equal(read.extras.palette, "cvd");
    assert.deepEqual(read.extras.needs, { noise: ["quiet"] });
  } finally {
    globalThis.window = previousWindow;
    globalThis.localStorage = previousStorage;
  }
});

function runBoot(stored: unknown) {
  return runBootRaw(JSON.stringify(stored));
}

function runBootRaw(raw: string | null) {
  const attrs = new Map<string, string>();
  const store = new Map<string, string>();
  if (raw != null) store.set(SETTINGS_STORAGE_KEY, raw);
  vm.runInNewContext(SETTINGS_BOOT_SCRIPT, {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    },
    document: {
      documentElement: {
        setAttribute: (name: string, value: string) => attrs.set(name, value),
        removeAttribute: (name: string) => attrs.delete(name),
      },
    },
  });
  return { attrs, themeKey: store.get(THEME_STORAGE_KEY) ?? null };
}
