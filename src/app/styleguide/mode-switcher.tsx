"use client";

import { useState } from "react";

// Preview-only controls for the style guide. They set the same data-*
// attributes the real settings (useSettings, SOS-31) will write, but don't
// persist anything.

type Setting = {
  attr: "theme" | "contrast" | "palette" | "text";
  legend: string;
  options: { label: string; value: string | null }[];
};

const SETTINGS: Setting[] = [
  {
    attr: "theme",
    legend: "Theme",
    options: [
      { label: "System", value: null },
      { label: "Light", value: "light" },
      { label: "Dark", value: "dark" },
    ],
  },
  {
    attr: "contrast",
    legend: "Contrast",
    options: [
      { label: "System", value: null },
      { label: "Normal", value: "normal" },
      { label: "More", value: "more" },
    ],
  },
  {
    attr: "palette",
    legend: "Palette",
    options: [
      { label: "Default", value: null },
      { label: "Colorblind-safe", value: "cvd" },
    ],
  },
  {
    attr: "text",
    legend: "Text size",
    options: [
      { label: "100%", value: null },
      { label: "112%", value: "112" },
      { label: "125%", value: "125" },
      { label: "150%", value: "150" },
    ],
  },
];

export function ModeSwitcher() {
  const [values, setValues] = useState<Record<string, string | null>>({});

  function choose(attr: Setting["attr"], value: string | null) {
    const root = document.documentElement;
    if (value === null) root.removeAttribute(`data-${attr}`);
    else root.setAttribute(`data-${attr}`, value);
    setValues((v) => ({ ...v, [attr]: value }));
  }

  return (
    <div className="flex flex-wrap gap-6">
      {SETTINGS.map((setting) => (
        <fieldset key={setting.attr} className="flex flex-col gap-1">
          <legend className="mb-1 font-medium">{setting.legend}</legend>
          {setting.options.map((option) => (
            <label key={option.label} className="flex items-center gap-2">
              <input
                type="radio"
                name={setting.attr}
                checked={(values[setting.attr] ?? null) === option.value}
                onChange={() => choose(setting.attr, option.value)}
                className="accent-primary"
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}
