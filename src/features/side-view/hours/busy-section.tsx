"use client";

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
export function BusySection({ buildingSlug, now }: { buildingSlug: string; now?: Date }) {
  const clock = now ?? new Date();
  const { times, loaded, error } = usePopularTimes(buildingSlug);
  if (!loaded || !times) {
    // The hours screen already says when Supabase itself is missing.
    if (loaded && error && error !== "Supabase isn't configured.") {
      return <p className="text-sm text-muted-foreground">{error}</p>;
    }
    return null;
  }
  return <BusyDays times={times} now={clock} />;
}

function BusyDays({ times, now }: { times: PopularTimes; now: Date }) {
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

  // The building panel's busyness tile opens this screen with #busyness.
  // replaceState does not fire hashchange, so check once the section exists.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const scroll = () => {
      if (window.location.hash !== "#busyness") return;
      section.scrollIntoView({ block: "start" });
    };
    scroll();
    const timer = window.setTimeout(scroll, 0);
    return () => window.clearTimeout(timer);
  }, []);

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
            className="h-auto min-h-0 w-auto gap-1 border-0 bg-transparent px-1 py-0 text-sm font-normal text-muted-foreground shadow-none"
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
        <p>No typical busyness.</p>
      )}
      {values ? <BusynessChart values={values} highlightHour={highlighted} /> : null}
    </section>
  );
}
