// Guest and account preferences share one JSON object. The account copy lives
// in public.user_settings.settings (see docs/technical/supabase-backend.md).
// "System" for a display setting means the data-* attribute is absent, so
// the media query in tokens.css decides.

export const SETTINGS_STORAGE_KEY = "soothe-settings";
// next-themes reads this before paint. Kept in step with settings.theme.
export const THEME_STORAGE_KEY = "soothe-theme";

export const THEME_VALUES = ["system", "light", "dark"] as const;
export const CONTRAST_VALUES = ["system", "normal", "more"] as const;
export const TEXT_VALUES = [100, 112.5, 125, 150] as const;
export const MOTION_VALUES = ["system", "reduce"] as const;
export const VIEW_VALUES = ["map", "list"] as const;

export type ThemeSetting = (typeof THEME_VALUES)[number];
export type ContrastSetting = (typeof CONTRAST_VALUES)[number];
export type TextSetting = (typeof TEXT_VALUES)[number];
export type MotionSetting = (typeof MOTION_VALUES)[number];
export type DefaultView = (typeof VIEW_VALUES)[number];

export type Settings = {
  theme: ThemeSetting;
  contrast: ContrastSetting;
  text: TextSetting;
  motion: MotionSetting;
  defaultView: DefaultView;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  contrast: "system",
  text: 100,
  motion: "system",
  defaultView: "map",
};

const KNOWN_KEYS = ["theme", "contrast", "text", "motion", "defaultView"] as const;

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly unknown[]).includes(value);
}

function isText(value: unknown): value is TextSetting {
  return typeof value === "number" && (TEXT_VALUES as readonly number[]).includes(value);
}

export function parseSettings(raw: unknown): {
  settings: Settings;
  extras: Record<string, unknown>;
} {
  const settings: Settings = { ...DEFAULT_SETTINGS };
  const extras: Record<string, unknown> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { settings, extras };
  }

  for (const [key, value] of Object.entries(raw)) {
    if (key === "theme" && isOneOf(THEME_VALUES, value)) settings.theme = value;
    else if (key === "contrast" && isOneOf(CONTRAST_VALUES, value)) settings.contrast = value;
    else if (key === "text" && isText(value)) settings.text = value;
    else if (key === "motion" && isOneOf(MOTION_VALUES, value)) settings.motion = value;
    else if (key === "defaultView" && isOneOf(VIEW_VALUES, value)) settings.defaultView = value;
    else if (!(KNOWN_KEYS as readonly string[]).includes(key)) extras[key] = value;
  }

  return { settings, extras };
}

export function settingsDocument(
  settings: Settings,
  extras: Record<string, unknown>,
): Record<string, unknown> {
  return { ...extras, ...settings };
}

// Attribute values written on <html>. null removes the attribute.
// The boot script below must make the same decisions; model.test.ts checks both.
export function displayAttributes(
  settings: Settings,
  extras: Record<string, unknown>,
): Record<string, string | null> {
  return {
    "data-theme": settings.theme === "light" || settings.theme === "dark" ? settings.theme : null,
    "data-contrast":
      settings.contrast === "normal" || settings.contrast === "more" ? settings.contrast : null,
    "data-text":
      settings.text === 112.5 ? "112" : settings.text === 125 || settings.text === 150 ? String(settings.text) : null,
    "data-motion": settings.motion === "reduce" ? "reduce" : null,
    "data-palette": extras.palette === "cvd" ? "cvd" : null,
  };
}

type AttributeElement = {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
};

export function applyDisplayAttributes(
  settings: Settings,
  extras: Record<string, unknown>,
  root: AttributeElement = document.documentElement,
) {
  for (const [name, value] of Object.entries(displayAttributes(settings, extras))) {
    if (value == null) root.removeAttribute(name);
    else root.setAttribute(name, value);
  }
}

export function readStoredSettings(): { settings: Settings; extras: Record<string, unknown> } {
  if (typeof window === "undefined") {
    return { settings: { ...DEFAULT_SETTINGS }, extras: {} };
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { settings: { ...DEFAULT_SETTINGS }, extras: {} };
    return parseSettings(JSON.parse(raw));
  } catch {
    return { settings: { ...DEFAULT_SETTINGS }, extras: {} };
  }
}

export function writeStoredSettings(
  settings: Settings,
  extras: Record<string, unknown>,
): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(settingsDocument(settings, extras)),
    );
    window.localStorage.setItem(THEME_STORAGE_KEY, settings.theme);
    return true;
  } catch {
    return false;
  }
}

// Runs from the root layout <head> before first paint. Also repairs the
// next-themes key so its body script doesn't override data-theme.
export const SETTINGS_BOOT_SCRIPT = `(function () {
  try {
    var raw = localStorage.getItem(${JSON.stringify(SETTINGS_STORAGE_KEY)});
    if (!raw) return;
    var s = JSON.parse(raw);
    var root = document.documentElement;
    function attr(name, value) {
      if (value == null) root.removeAttribute(name);
      else root.setAttribute(name, value);
    }
    if (s.theme === "light" || s.theme === "dark" || s.theme === "system") {
      try { localStorage.setItem(${JSON.stringify(THEME_STORAGE_KEY)}, s.theme); } catch (e) {}
    }
    attr("data-theme", s.theme === "light" || s.theme === "dark" ? s.theme : null);
    attr("data-contrast", s.contrast === "more" || s.contrast === "normal" ? s.contrast : null);
    attr("data-text", s.text === 112.5 ? "112" : s.text === 125 || s.text === 150 ? String(s.text) : null);
    attr("data-motion", s.motion === "reduce" ? "reduce" : null);
    attr("data-palette", s.palette === "cvd" ? "cvd" : null);
  } catch (e) {}
})();`;
