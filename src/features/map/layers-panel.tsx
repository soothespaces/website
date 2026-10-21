"use client";

import { Collapsible } from "radix-ui";
import { useState } from "react";
import { LayersIcon } from "@/components/ui/icons";
import { panelRegistry } from "@/features/side-view/registry";
import { useMapState } from "./map-state";

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

// Toggles for the map's layers, with a key for each. Starts as a button so
// it doesn't cover the map; on phones it sits under the search bar.
export function LayersPanel({
  shown,
  onChange,
  error,
}: {
  shown: LayerToggles;
  onChange: (shown: LayerToggles) => void;
  error: string | null;
}) {
  const [open, setOpen] = useState(false);
  const { route } = useMapState();
  // The floating search bar is gone while Home is open, so the button sits higher.
  const home = route.kind === "home" && Boolean(panelRegistry.home);

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className={`absolute left-2.5 z-10 rounded-md bg-card text-card-foreground shadow-[0_0_0_1px_var(--input)] md:top-2.5 ${
        home ? "top-2.5" : "top-[4.25rem]"
      }`}
      // Keeps the panel clear of the zoom and locate buttons on the right.
      // A map overlay, not a page column, so it isn't PageWidth.
      style={{ maxWidth: "calc(100% - 5rem)" }}
    >
      <Collapsible.Trigger className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <LayersIcon className="size-5" />
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
            <p role="status" className="mt-1 w-0 min-w-full text-xs text-muted-foreground">
              {error} Entrances and study spaces aren&rsquo;t shown.
            </p>
          ) : null}
        </fieldset>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
