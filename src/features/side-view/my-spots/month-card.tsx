"use client";

import { useId } from "react";
import { Skeleton } from "@/components/ui/feedback";
import { monthlyStats, type MyHistoryState } from "@/lib/data/my-history";
import { monthCardModel } from "./copy";

// J2. The private monthly summary at the top of Your spots.
export function MonthCard({ now, history }: { now: Date; history: MyHistoryState }) {
  const titleId = useId();

  if (!history.loaded) {
    return (
      <div role="status" className="rounded-xl bg-muted px-4 py-3">
        <span className="sr-only">Loading this month</span>
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (history.error) {
    return <p className="text-sm text-muted-foreground">{history.error}</p>;
  }

  const model = monthCardModel(monthlyStats(history.places, now));
  return (
    <section aria-labelledby={titleId} className="rounded-xl bg-muted px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={titleId} className="text-sm">
          {model.title}
        </h2>
        <p className="text-right text-xs text-muted-foreground">Only you can see this</p>
      </div>
      {model.empty ? (
        <p className="mt-3 text-sm">{model.empty}</p>
      ) : (
        <div className={`mt-3 grid gap-2 ${model.stats.length > 2 ? "grid-cols-3" : "grid-cols-2"}`}>
          {model.stats.map((stat) => (
            <p key={stat.label}>
              <span className="block text-2xl font-semibold tabular-nums">{stat.value}</span>
              <span className="block text-xs text-muted-foreground">{stat.label}</span>
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
