import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {
  DEFAULT_SETTINGS,
  DEFAULT_STUDY,
  SETTINGS_BOOT_SCRIPT,
  SETTINGS_STORAGE_KEY,
  THEME_STORAGE_KEY,
  applyDisplayAttributes,
  displayAttributes,
  parseSettings,
  readStoredSettings,
  settingsDocument,
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

test("settings saved before study preferences still parse", () => {
  const parsed = parseSettings({
    theme: "light",
    contrast: "more",
    text: 125,
    motion: "reduce",
    defaultView: "list",
    palette: "cvd",
  });

  assert.equal(parsed.settings.theme, "light");
  assert.deepEqual(parsed.settings.study, DEFAULT_STUDY);
  assert.deepEqual(parsed.extras, { palette: "cvd" });
  assert.equal("study" in parsed.extras, false);
});

test("study preferences round-trip, and unknown values fall back", () => {
  const parsed = parseSettings({
    theme: "dark",
    needs: { noise: ["quiet"] },
    study: {
      noise: "quiet",
      setting: "cave",
      brightness: "dim",
      daylight: "lots",
      niceToHave: ["printer", "nope", "outlets", "printer"],
      when: ["late_night", "mornings", "noon"],
      later: true,
    },
  });

  assert.deepEqual(parsed.settings.study, {
    noise: "quiet",
    setting: "any",
    brightness: "dim",
    daylight: "lots",
    niceToHave: ["printer", "outlets"],
    when: ["late_night", "mornings"],
  });
  assert.deepEqual(parsed.extras, { needs: { noise: ["quiet"] }, study: { later: true } });

  const again = parseSettings(settingsDocument(parsed.settings, parsed.extras));
  assert.deepEqual(again.settings, parsed.settings);
  assert.deepEqual(again.extras, parsed.extras);
});

test("an unusable study value falls back without landing in extras", () => {
  const parsed = parseSettings({ study: "quiet", theme: "dark" });
  assert.equal(parsed.settings.theme, "dark");
  assert.deepEqual(parsed.settings.study, DEFAULT_STUDY);
  assert.deepEqual(parsed.extras, {});

  const missingLists = parseSettings({ study: { niceToHave: "printer", when: null, noise: "loud" } });
  assert.deepEqual(missingLists.settings.study, DEFAULT_STUDY);
  assert.deepEqual(missingLists.extras, {});
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

    store.set(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        theme: "light",
        contrast: "normal",
        text: 100,
        motion: "system",
        defaultView: "map",
        study: { noise: "conversational", when: ["evenings"], later: 1 },
      }),
    );
    const legacy = readStoredSettings();
    assert.equal(legacy.settings.theme, "light");
    assert.equal(legacy.settings.study.noise, "conversational");
    assert.deepEqual(legacy.settings.study.when, ["evenings"]);
    assert.equal(legacy.settings.study.setting, "any");
    assert.deepEqual(legacy.extras.study, { later: 1 });

    assert.equal(writeStoredSettings(legacy.settings, legacy.extras), true);
    const storedAgain = readStoredSettings();
    assert.deepEqual(storedAgain.settings.study, legacy.settings.study);
    assert.deepEqual(storedAgain.extras.study, { later: 1 });
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
