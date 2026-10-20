"use client";

import { Button } from "@/components/ui/button";
import { NoiseBadge } from "@/components/ui/noise-badge";
import { SectionHeader } from "@/components/ui/section-header";
import { useMapState } from "@/features/map/map-state";
import { buildingLabel, orderOpenNow, placeMeta, type HomeSpace } from "./places";

const SHOWN = 3;

export function OpenNearby({ spaces }: { spaces: HomeSpace[] }) {
  const { origin, select } = useMapState();
  const rows = orderOpenNow(spaces, origin).slice(0, SHOWN);
  const title = origin ? "Open now nearby" : "Open now";

  return (
    <section className="flex flex-col gap-1">
      <SectionHeader title={title} />
      {rows.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">Nothing is open right now.</p>
      ) : (
        <ul>
          {rows.map((space) => (
            <li key={space.slug}>
              <Button
                variant="ghost"
                onClick={(event) => {
                  event.currentTarget.blur();
                  select({ kind: "space", slug: space.slug });
                }}
                className="h-auto min-h-11 w-full shrink items-center justify-start gap-3 rounded-none border-b border-border px-1 py-3 text-left font-normal"
              >
                <Thumb space={space} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold tracking-tight">{space.name}</span>
                  <span className="text-xs text-muted-foreground">{placeMeta([buildingLabel(space.building), space.openLabel])}</span>
                </span>
                {space.noise_level ? <NoiseBadge level={space.noise_level} size="sm" /> : null}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Thumb({ space }: { space: HomeSpace }) {
  const alt = space.image_alt?.trim() || "";
  if (!space.image_url) {
    return <span aria-hidden="true" className="size-11 shrink-0 rounded-md bg-muted" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={space.image_url} alt={alt} className="size-11 shrink-0 rounded-md object-cover" />
  );
}
