"use client";

import { CheckInHereButton } from "@/features/check-in/check-in-here";
import { FloorSwitcher } from "@/features/map/panel/floor-switcher";
import { useMapState } from "@/features/map/map-state";
import type { PanelScreenProps } from "@/features/side-view/builtin-screens";
import { buildingSubtitle } from "./copy";
import { BuildingFacts, buildingEntrances } from "./facts";
import { BuildingHeader } from "./header";
import { RecommendedSection } from "./recommended";
import { RoomsPreview } from "./rooms-preview";
import { SpacesPreview } from "./spaces-preview";
import { BuildingTiles } from "./tiles";
import { useBuildingProfile } from "./queries";

// The building route. The header, tiles, recommendations, study spaces and
// rooms each live in their own file; this screen is the order they stack in,
// plus the entrance notes and the floor control the map already followed.
export function BuildingPanelScreen({ route }: PanelScreenProps) {
  const { data, floorPlans, floor, setFloor, back, clear, canGoBack, push } = useMapState();
  const slug = route.kind === "building" ? route.slug : null;
  const profile = useBuildingProfile(slug);

  if (route.kind !== "building") return null;

  const known = slug ? data.buildingsBySlug.get(slug) : undefined;
  const recordNumber = route.recordNumber ?? known?.recordNumber ?? null;
  const name = profile.data?.shortName || profile.data?.name || route.name || known?.name || "Building";
  const subtitle = buildingSubtitle(profile.data?.acronym, profile.data?.address);
  const plans = slug ? floorPlans.get(slug) : undefined;
  const entrances = buildingEntrances(data.entrances, slug, recordNumber);

  return (
    <div
      data-detail-scroll=""
      className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-1 pb-6"
    >
      <BuildingHeader
        slug={slug}
        name={name}
        onBack={canGoBack ? back : clear}
        onClose={clear}
        onOpenPhotos={() => {
          if (slug) push({ kind: "photos", slug });
        }}
      />
      <div className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="text-2xl break-words">{name}</h2>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {slug ? <CheckInHereButton buildingSlug={slug} buildingName={name} /> : null}
      </div>
      <BuildingTiles slug={slug} />
      <RecommendedSection slug={slug} />
      <SpacesPreview slug={slug} />
      <RoomsPreview slug={slug} />
      <BuildingFacts
        entrances={entrances}
        entrancesKnown={data.loaded && !data.error && data.entrances.length > 0}
        rampAccess={profile.data?.rampAccess ?? null}
        elevatorAccess={profile.data?.elevatorAccess ?? null}
      />
      {plans?.length ? <FloorSwitcher floors={plans} floor={floor} onChange={setFloor} /> : null}
    </div>
  );
}

