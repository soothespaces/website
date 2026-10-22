"use client";

import { STUDY_STEP_LABEL, type StudyStep } from "./layers/study-building-counts";

const STEPS: StudyStep[] = ["study-1", "study-2", "study-5", "study-10"];

// Shown on the campus view. The floor-plan legend takes this corner once a
// floor is open. It does not follow the zoom, so it doesn't pop in and out.
export function StudyLegend() {
  return (
    <section
      aria-label="Study buildings"
      className="absolute right-2.5 bottom-8 z-10 max-md:bottom-[46%] flex flex-col gap-1.5 rounded-md bg-card px-3 py-3 text-card-foreground shadow-[0_0_0_1px_var(--input)]"
    >
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground">STUDY SPACES</h3>
      <ul className="flex flex-col gap-1.5">
        {STEPS.map((step) => (
          <li key={step} className="flex items-center gap-2 text-sm">
            <span aria-hidden="true" className="size-4 shrink-0 rounded-sm" style={{ backgroundColor: `var(--${step})` }} />
            <span>{STUDY_STEP_LABEL[step]}</span>
          </li>
        ))}
        <li className="flex items-center gap-2 text-sm">
          <span aria-hidden="true" className="not-study-swatch size-4 shrink-0 rounded-sm" />
          <span>Not a study building</span>
        </li>
      </ul>
    </section>
  );
}
