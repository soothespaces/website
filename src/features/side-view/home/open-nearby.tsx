"use client";

import { safeSpaceImageUrl } from "@/features/side-view/spaces/use-building-spaces";
import { Button } from "@/components/ui/button";
import { NoiseBadge } from "@/components/ui/noise-badge";
import { SectionHeader } from "@/components/ui/section-header";
import { useMapState } from "@/features/map/map-state";
import { useLocation } from "@/lib/location/use-location";
import { buildingLabel, orderOpenNow, placeMeta, type HomeSpace } from "./places";
import { PLACE_ROW_CLASS, PLACE_THUMB_CLASS } from "../place-row";

const SHOWN = 3;

export function OpenNearby({ spaces }: { spaces: HomeSpace[] }) {
  const { select } = useMapState();
  const { position } = useLocation();
  const rows = orderOpenNow(spaces, position).slice(0, SHOWN);
  const title = position ? "Open now nearby" : "Open now";

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
                className={PLACE_ROW_CLASS}
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
  const src = safeSpaceImageUrl(space.image_url);
  if (!src) {
    return <span aria-hidden="true" className={PLACE_THUMB_CLASS} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={`${PLACE_THUMB_CLASS} object-cover`} />
  );
}
