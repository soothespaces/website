"use client";

import { Collapsible } from "radix-ui";
import { useState } from "react";

export type LayerToggles = {
  campus: boolean;
  entrances: boolean;
  curbRamps: boolean;
  spaces: boolean;
};

const OPTIONS: { key: keyof LayerToggles; label: string; hint?: string; swatch: "pin" | "door" | "ramp" | "campus" }[] = [
  { key: "spaces", label: "Study spaces", swatch: "pin" },
  { key: "entrances", label: "Accessible entrances", hint: "Filled: automatic door", swatch: "door" },
  { key: "curbRamps", label: "Curb ramps", swatch: "ramp" },
  { key: "campus", label: "Campus detail", hint: "Paths, lawns and buildings from U-M", swatch: "campus" },
];

function Swatch({ kind }: { kind: (typeof OPTIONS)[number]["swatch"] }) {
  const base = "shrink-0";
  switch (kind) {
    case "pin":
      return <span aria-hidden="true" className={`${base} size-3.5 rounded-full border-2 border-card bg-primary shadow-sm`} />;
    case "door":
      return (
        <span aria-hidden="true" className={`${base} flex gap-0.5`}>
          <span className="size-2.5 rounded-full border-[1.5px] border-primary bg-primary" />
          <span className="size-2.5 rounded-full border-[1.5px] border-primary bg-card" />
        </span>
      );
    case "ramp":
      return <span aria-hidden="true" className={`${base} h-1 w-3.5 rounded-full bg-primary`} />;
    case "campus":
      return <span aria-hidden="true" className={`${base} size-3.5 rounded-sm border border-muted-foreground/50 bg-muted`} />;
  }
}

function LayersIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </svg>
  );
}

// Toggles for the map's layers, with a key for each. Open by default on wide
// screens; on phones it starts as a button so it doesn't cover the map.
export function LayersPanel({
  shown,
  onChange,
  error,
}: {
  shown: LayerToggles;
  onChange: (shown: LayerToggles) => void;
  error: string | null;
}) {
  const [open, setOpen] = useState(() => window.matchMedia("(min-width: 40rem)").matches);

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className="absolute left-2.5 top-2.5 z-10 max-w-[calc(100%-5rem)] rounded-md bg-card text-card-foreground shadow-[0_0_0_1px_var(--input)]"
    >
      <Collapsible.Trigger className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <LayersIcon />
        Layers
      </Collapsible.Trigger>
      <Collapsible.Content>
        <fieldset className="flex flex-col gap-1 border-t border-border px-3 pt-2 pb-3">
          <legend className="sr-only">Show on the map</legend>
          {OPTIONS.map((option) => (
            <label key={option.key} className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={shown[option.key]}
                onChange={(event) => onChange({ ...shown, [option.key]: event.target.checked })}
                className="size-4 accent-primary"
              />
              <Swatch kind={option.swatch} />
              <span className="flex flex-col">
                {option.label}
                {option.hint ? <span className="text-xs text-muted-foreground">{option.hint}</span> : null}
              </span>
            </label>
          ))}
          {error ? (
            <p role="status" className="mt-1 max-w-56 text-xs text-muted-foreground">
              {error} Entrances and study spaces aren&rsquo;t shown.
            </p>
          ) : null}
        </fieldset>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
