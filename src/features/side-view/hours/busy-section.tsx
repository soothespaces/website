"use client";

import { ErrorNote } from "@/components/ui/error-note";
import { useEffect, useId, useRef, useState } from "react";
import { BusynessChart } from "@/components/ui/busyness-chart";
import { Label } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { busynessWord, usePopularTimes, type PopularTimes } from "@/lib/data/popular-times";
import { detroitParts } from "@/lib/detroit";
import { BUSY_DAY_OPTIONS } from "./hours-copy";
import { busySummary, chartValues, highlightHour } from "./busy-copy";

// Under the week list. Hidden when the building has no popular times, so a
// building without a curve does not show an empty chart.
export function BusySection({
  buildingSlug,
  now,
  focus = false,
}: {
  buildingSlug: string;
  now?: Date;
  focus?: boolean;
}) {
  const clock = now ?? new Date();
  const { times, loaded, error } = usePopularTimes(buildingSlug);
  if (!loaded || !times) {
    // The hours screen already says when Supabase itself is missing.
    if (loaded && error && error !== "Supabase isn't configured.") {
      return <ErrorNote message={error} />;
    }
    return null;
  }
  return <BusyDays times={times} now={clock} focus={focus} />;
}

function BusyDays({ times, now, focus }: { times: PopularTimes; now: Date; focus: boolean }) {
  const dayId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const parts = detroitParts(now);
  const today = String(parts.weekday);
  const [choice, setChoice] = useState(today);
  const weekday = BUSY_DAY_OPTIONS.some((option) => option.value === choice) ? choice : today;
  const dayIndex = Number(weekday);
  const day = times.busyness[dayIndex];
  const typical = day?.[parts.hour];
  const word = typical == null ? null : busynessWord(typical);
  const summary = busySummary(day, parts.hour, word);
  const values = chartValues(day);
  const highlighted = highlightHour(dayIndex, parts.weekday, parts.hour);

  // The building's busyness tile opens this screen with focus "chart".
  // Scroll once the section exists, then again after the panel lays out.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !focus) return;
    // Scroll the panel, never the page: scrollIntoView also moved the
    // document and pulled the header off screen (DA-08).
    const scroll = () => scrollPanelTo(section);
    scroll();
    const timer = window.setTimeout(scroll, 0);
    return () => window.clearTimeout(timer);
  }, [focus]);

  return (
    <section id="busyness" ref={sectionRef} className="flex flex-col gap-3" aria-labelledby={`${dayId}-heading`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={`${dayId}-heading`} className="text-base">
          How busy it gets
        </h2>
        <div>
          <Label htmlFor={dayId} className="sr-only">
            Day
          </Label>
          <Select
            id={dayId}
            value={weekday}
            onValueChange={(value) => {
              if (value) setChoice(value);
            }}
            options={BUSY_DAY_OPTIONS}
            className="h-auto min-h-8 w-auto cursor-pointer gap-1 rounded-md border-0 bg-transparent px-2 py-1 text-sm font-normal text-muted-foreground shadow-none hover:bg-accent hover:text-foreground"
          />
        </div>
      </div>
      {summary.usual || summary.peak ? (
        <p aria-live="polite">
          {summary.usual ? <span className="font-semibold">{summary.usual}</span> : null}
          {summary.usual && summary.peak ? " " : null}
          {summary.peak}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Not enough data for this day.</p>
      )}
      {values ? <BusynessChart values={values} highlightHour={highlighted} /> : null}
    </section>
  );
}

// The nearest ancestor that scrolls, brought to the section's top.
function scrollPanelTo(section: HTMLElement) {
  for (let parent = section.parentElement; parent; parent = parent.parentElement) {
    const overflow = getComputedStyle(parent).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && parent.scrollHeight > parent.clientHeight) {
      const top = section.getBoundingClientRect().top - parent.getBoundingClientRect().top + parent.scrollTop;
      parent.scrollTo({ top });
      return;
    }
  }
}
