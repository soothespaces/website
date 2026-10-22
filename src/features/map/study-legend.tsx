"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { STUDY_STEP_LABEL, type StudyStep } from "./layers/study-building-counts";

const STEPS: StudyStep[] = ["study-1", "study-2", "study-5", "study-10"];

// Shown on the campus view. The floor-plan legend takes this corner once a
// floor is open. It does not follow the zoom, so it doesn't pop in and out.
// Phones start collapsed to a Legend button, like the floor-plan legend, so
// it doesn't cover the small map.
export function StudyLegend() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <section
      aria-label="Study buildings"
      className="absolute right-2.5 bottom-8 z-10 max-md:bottom-[46%] rounded-md bg-card text-card-foreground shadow-[0_0_0_1px_var(--input)]"
    >
      <Button
        variant="ghost"
        className="w-full justify-start md:hidden"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        Legend
      </Button>
      <div id={panelId} className={open ? "flex flex-col gap-1.5 px-3 pt-1 pb-3" : "hidden flex-col gap-1.5 px-3 py-3 md:flex"}>
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground">STUDY SPACES</h3>
        <ul className="flex flex-col gap-1.5">
          {STEPS.map((step) => (
            <li key={step} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden="true"
                className="size-4 shrink-0 rounded-sm border border-foreground"
                style={{ backgroundColor: `var(--${step})` }}
              />
              <span>{STUDY_STEP_LABEL[step]}</span>
            </li>
          ))}
          <li className="flex items-center gap-2 text-sm">
            <span aria-hidden="true" className="not-study-swatch size-4 shrink-0 rounded-sm" />
            <span>Not a study building</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
