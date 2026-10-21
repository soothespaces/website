"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DetailScreen } from "@/components/ui/detail-screen";
import { useMapState } from "@/features/map/map-state";
import { useStudyPreferences } from "@/lib/settings/settings-provider";
import type { StudyPreferences } from "@/lib/settings/model";
import { ROUTES } from "@/lib/site";
import type { PanelScreenProps } from "../registry";
import { panelBackLabel } from "./back-label";
import { PreferencesForm } from "./preferences-form";

const SETTINGS_HREF = `${ROUTES.accountPreferences}#study-preferences`;

export function PreferencesScreen({ route }: PanelScreenProps) {
  const { back, stack, data } = useMapState();
  const { study, ready, updateStudy } = useStudyPreferences();
  const [draft, setDraft] = useState<StudyPreferences | null>(null);
  const value = draft ?? study;

  if (route.kind !== "preferences") return null;

  const parent = stack.at(-2);
  const building =
    parent?.kind === "building"
      ? parent.name || (parent.slug ? data.buildingsBySlug.get(parent.slug)?.name : null)
      : null;
  const space = parent?.kind === "space" ? data.spaces.find((item) => item.slug === parent.id)?.name : null;

  function leave() {
    setDraft(null);
    back();
  }

  function save() {
    if (!ready) return;
    updateStudy(value);
    setDraft(null);
    back();
  }

  return (
    <DetailScreen
      title="How you like to study"
      backTo={panelBackLabel(parent, { building, space })}
      onBack={leave}
      className="min-h-0 flex-1"
      footer={
        <div className="flex flex-col gap-2">
          <Button className="w-full" onClick={save} disabled={!ready}>
            Save preferences
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            These sort your results; nothing gets hidden. Change them anytime in{" "}
            <Link href={SETTINGS_HREF} className="text-foreground underline underline-offset-4">
              Settings
            </Link>
            .
          </p>
        </div>
      }
    >
      <PreferencesForm value={value} onChange={setDraft} pending={!ready} />
    </DetailScreen>
  );
}
