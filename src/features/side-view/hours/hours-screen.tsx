"use client";

import { DetailScreen } from "@/components/ui/detail-screen";
import { SectionHeader } from "@/components/ui/section-header";
import { useMapState } from "@/features/map/map-state";
import { cx } from "@/lib/cx";
import { nextClose, openStatus, useOpeningHours, weekRows, type WeekRow } from "@/lib/data/opening-hours";
import type { PanelScreenProps } from "../builtin-screens";
import { BusySection } from "./busy-section";
import { hoursSourceNote, nextCloseLine, statusHeadline, weekDayLabel } from "./hours-copy";

export function HoursScreen({ route }: PanelScreenProps) {
  const { back } = useMapState();
  if (route.kind !== "hours") return null;
  return <HoursBody slug={route.slug} focusChart={route.focus === "chart"} onBack={back} />;
}

function HoursBody({ slug, focusChart, onBack }: { slug: string; focusChart: boolean; onBack: () => void }) {
  const now = new Date();
  const building = useBuildingLabel(slug);
  const { hours, loaded, error } = useOpeningHours({ buildingSlug: slug });
  const rows = weekRows(hours);
  const note = hoursSourceNote(hours?.periods ?? []);
  const status = openStatus(hours, now);
  let headline: string | null = null;
  let headlineClass = "text-xl font-semibold text-primary";
  let message: string | null = null;
  if (!loaded) {
    message = "Loading hours…";
  } else if (!hours) {
    if (error) message = error;
    else {
      headline = "Hours not listed";
      headlineClass = "text-xl font-semibold";
    }
  } else {
    headline = statusHeadline(status);
  }
  // "Open until 7 PM" already names the close. The second line is only for a
  // 24-hour day, where the headline does not say when it finally closes.
  const close = headline === "Open 24 hours today" ? nextCloseLine(nextClose(hours, now)) : null;

  return (
    <DetailScreen title="Hours" subtitle={building} backTo={building} onBack={onBack} className="min-h-0 flex-1">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1" aria-live="polite">
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          {headline ? <p className={headlineClass}>{headline}</p> : null}
          {hours && close ? <p>{close}</p> : null}
        </div>
        {hours ? (
          <section className="flex flex-col gap-3">
            <SectionHeader title="This week" />
            <WeekList rows={rows} />
            {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
          </section>
        ) : null}
        <BusySection buildingSlug={slug} now={now} focus={focusChart} />
      </div>
    </DetailScreen>
  );
}

function WeekList({ rows }: { rows: WeekRow[] }) {
  return (
    <dl>
      {rows.map((row) => (
        <div
          key={row.date}
          className={cx(
            "flex items-baseline justify-between gap-3 border-b border-border px-2 py-2 last:border-b-0",
            row.today && "rounded-lg border-transparent bg-primary/10 font-semibold",
          )}
        >
          <dt className="shrink-0" aria-current={row.today ? "date" : undefined}>
            {weekDayLabel(row.day, row.today)}
          </dt>
          <dd className="min-w-0 text-right">{row.hours}</dd>
        </div>
      ))}
    </dl>
  );
}

// The map already loaded every building, including short_name. Reading it
// here avoids a second buildings query when the building panel has the same row.
function useBuildingLabel(slug: string): string {
  const { data } = useMapState();
  const known = data.buildingsBySlug.get(slug);
  return known?.shortName || known?.name || "Building";
}
