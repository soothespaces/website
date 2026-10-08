"use client";

import { RadioGroup } from "radix-ui";
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

// Radix needs string values; this one stands for "no attribute".
const UNSET = "unset";

export function ModeSwitcher() {
  const [values, setValues] = useState<Record<string, string>>({});

  function choose(attr: Setting["attr"], value: string) {
    const root = document.documentElement;
    if (value === UNSET) root.removeAttribute(`data-${attr}`);
    else root.setAttribute(`data-${attr}`, value);
    setValues((v) => ({ ...v, [attr]: value }));
  }

  return (
    <div className="flex flex-wrap gap-6">
      {SETTINGS.map((setting) => (
        <div key={setting.attr} className="flex flex-col gap-1">
          <span id={`mode-${setting.attr}`} className="mb-1 font-medium">
            {setting.legend}
          </span>
          <RadioGroup.Root
            aria-labelledby={`mode-${setting.attr}`}
            value={values[setting.attr] ?? UNSET}
            onValueChange={(value) => choose(setting.attr, value)}
            className="flex flex-col gap-1"
          >
            {setting.options.map((option) => {
              const id = `mode-${setting.attr}-${option.value ?? UNSET}`;
              return (
                <div key={option.label} className="flex items-center gap-2">
                  <RadioGroup.Item
                    id={id}
                    value={option.value ?? UNSET}
                    className="flex size-4 items-center justify-center rounded-full border border-input bg-background data-[state=checked]:border-primary"
                  >
                    <RadioGroup.Indicator className="size-2 rounded-full bg-primary" />
                  </RadioGroup.Item>
                  <label htmlFor={id}>{option.label}</label>
                </div>
              );
            })}
          </RadioGroup.Root>
        </div>
      ))}
    </div>
  );
}
