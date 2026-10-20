"use client";

import { useEffect, useState } from "react";
import { DetailScreen } from "@/components/ui/detail-screen";
import { SectionHeader } from "@/components/ui/section-header";
import { useMapState } from "@/features/map/map-state";
import { cx } from "@/lib/cx";
import { nextClose, openStatus, useOpeningHours, weekRows, type WeekRow } from "@/lib/data/opening-hours";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { PanelScreenProps } from "../builtin-screens";
import { BusySection } from "./busy-section";
import { hoursSourceNote, nextCloseLine, statusHeadline, weekDayLabel } from "./hours-copy";

export function HoursScreen({ route }: PanelScreenProps) {
  const { back } = useMapState();
  if (route.kind !== "hours") return null;
  return <HoursBody slug={route.slug} onBack={back} />;
}

function HoursBody({ slug, onBack }: { slug: string; onBack: () => void }) {
  const now = new Date();
  const building = useBuildingLabel(slug);
  const { hours, loaded, error } = useOpeningHours({ buildingSlug: slug });
  const rows = weekRows(hours);
  const note = hoursSourceNote(hours?.periods ?? []);
  const status = openStatus(hours, now);
  const close = nextCloseLine(nextClose(hours, now));

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

  return (
    <DetailScreen title="Hours" subtitle={building} backTo={building} onBack={onBack} className="h-full min-h-0">
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
        <BusySection buildingSlug={slug} now={now} />
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
          <dt aria-current={row.today ? "date" : undefined}>{weekDayLabel(row.day, row.today)}</dt>
          <dd className="text-right whitespace-nowrap">{row.hours}</dd>
        </div>
      ))}
    </dl>
  );
}

// Prefer the short name ("Shapiro Library") once it loads. The map's name
// is the long official one, which is what we show until then.
function useBuildingLabel(slug: string): string {
  const { data } = useMapState();
  const fallback = data.buildingsBySlug.get(slug)?.name || "Building";
  const [short, setShort] = useState<{ slug: string; name: string } | null>(null);

  useEffect(() => {
    if (!getSupabaseEnv()) return;
    const supabase = createClient();
    let cancelled = false;
    supabase
      .from("buildings")
      .select("short_name, name")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data: row, error }) => {
        if (cancelled || error || !row) return;
        const name = row.short_name?.trim() || row.name;
        if (name) setShort({ slug, name });
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return short?.slug === slug ? short.name : fallback;
}
