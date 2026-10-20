"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { NoiseBadge } from "@/components/ui/noise-badge";
import { SectionHeader } from "@/components/ui/section-header";
import { useMapState } from "@/features/map/map-state";
import type { Coordinates } from "@/lib/location";
import { useStudyPreferences } from "@/lib/settings/settings-provider";
import {
  buildingLabel,
  orderRecommended,
  placeMeta,
  selectedGroupSize,
  spaceMeters,
  walkLabel,
  type HomeSpace,
  type RecommendedPick,
} from "./places";

const SHOWN = 3;

export function Recommended({ spaces }: { spaces: HomeSpace[] }) {
  const { origin, groupSize, filters, push, select } = useMapState();
  const { study } = useStudyPreferences();
  const picks = orderRecommended(spaces, {
    study,
    groupSize: selectedGroupSize(groupSize),
    origin,
    filters,
  }).slice(0, SHOWN);
  const listKey = picks.map((pick) => pick.space.slug).join("|");

  return (
    <section className="flex flex-col gap-2">
      <SectionHeader title="Recommended" action={{ label: "Refine", onClick: () => push({ kind: "preferences" }) }} />
      {picks.length > 0 ? (
        <RecommendationCard
          key={listKey}
          picks={picks}
          origin={origin}
          onOpen={(slug) => select({ kind: "space", slug })}
        />
      ) : (
        <p className="text-sm text-muted-foreground">No study spaces to recommend.</p>
      )}
    </section>
  );
}

function RecommendationCard({
  picks,
  origin,
  onOpen,
}: {
  picks: RecommendedPick[];
  origin: Coordinates | null;
  onOpen: (slug: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const pick = picks[Math.min(index, picks.length - 1)]!;
  const space = pick.space;
  const total = picks.length;
  const swiped = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const meta = placeMeta([buildingLabel(space.building), space.openLabel, walkLabel(spaceMeters(space, origin))]);
  const go = (delta: number) => setIndex((value) => Math.min(total - 1, Math.max(0, value + delta)));

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card">
      <p className="sr-only" aria-live="polite">
        {`Recommendation ${index + 1} of ${total}: ${space.name}`}
      </p>
      <Button
        variant="ghost"
        onClick={(event) => {
          if (swiped.current) {
            swiped.current = false;
            return;
          }
          event.currentTarget.blur();
          onOpen(space.slug);
        }}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          start.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event) => {
          const began = start.current;
          start.current = null;
          if (!began || total < 2) return;
          const dx = event.clientX - began.x;
          const dy = event.clientY - began.y;
          if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
          swiped.current = true;
          go(dx < 0 ? 1 : -1);
        }}
        className="h-auto min-h-0 w-full shrink touch-pan-y flex-col items-stretch gap-0 rounded-none p-0 text-left font-normal hover:bg-transparent"
      >
        <SpacePhoto space={space} />
        <span className="flex flex-col gap-1 px-3 py-3">
          <span className="flex items-start justify-between gap-2">
            <span className="text-base font-semibold tracking-tight">{space.name}</span>
            {space.noise_level ? <NoiseBadge level={space.noise_level} size="sm" /> : null}
          </span>
          {meta ? <span className="text-sm text-muted-foreground">{meta}</span> : null}
          {pick.matchesLine ? <span className="text-sm text-muted-foreground">{pick.matchesLine}</span> : null}
        </span>
      </Button>
      {total > 1 ? (
        <div className="pointer-events-none absolute inset-x-2 top-16 flex -translate-y-1/2 justify-between">
          <Button
            variant="outline"
            size="icon-sm"
            shape="circle"
            aria-label="Previous recommendation"
            disabled={index === 0}
            onClick={() => go(-1)}
            className="pointer-events-auto bg-card/90"
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            shape="circle"
            aria-label="Next recommendation"
            disabled={index === total - 1}
            onClick={() => go(1)}
            className="pointer-events-auto bg-card/90"
          >
            <ChevronRightIcon />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SpacePhoto({ space }: { space: HomeSpace }) {
  const alt = space.image_alt?.trim() || `Interior: ${space.name}`;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!space.image_url || failedSrc === space.image_url) {
    return (
      <span className="flex h-36 items-center justify-center bg-muted px-6 text-center text-sm text-muted-foreground">{alt}</span>
    );
  }
  return (
    // Library photos are hosted off-site, so this is a plain image.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={space.image_url} alt={alt} className="h-36 w-full object-cover" onError={() => setFailedSrc(space.image_url ?? null)} />
  );
}
