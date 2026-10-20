"use client";

import { Button } from "@/components/ui/button";
import { DEFAULT_STUDY } from "@/lib/settings/model";
import { useStudyPreferences } from "@/lib/settings/settings-provider";
import { PreferencesForm } from "./preferences-form";

// Same groups as the side panel, saved the way the rest of Settings saves:
// each change goes through the settings provider, which writes this device
// and the account when someone is signed in.
export function StudyPreferencesSection() {
  const { study, ready, updateStudy } = useStudyPreferences();

  return (
    <section id="study-preferences" aria-labelledby="study-preferences-heading" className="flex scroll-mt-24 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 id="study-preferences-heading" className="text-xl">
          Study preferences
        </h2>
        <p className="text-muted-foreground">These sort your results; nothing gets hidden.</p>
      </div>
      <PreferencesForm
        value={study}
        pending={!ready}
        onChange={(next) => {
          if (ready) updateStudy(next);
        }}
      />
      <Button
        variant="ghost"
        size="sm"
        className="self-start px-1 underline"
        disabled={!ready}
        onClick={() => updateStudy({ ...DEFAULT_STUDY, niceToHave: [], when: [] })}
      >
        Reset
      </Button>
    </section>
  );
}
