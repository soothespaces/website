"use client";

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
function BuildingScreen({ route }: PanelScreenProps) {
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
    <div className="flex flex-col gap-5 px-1 pb-6">
      <BuildingHeader
        slug={slug}
        name={name}
        onBack={canGoBack ? back : clear}
        onClose={clear}
        onOpenPhotos={() => {
          if (slug) push({ kind: "photos", slug });
        }}
      />
      <div className="px-1">
        <h2 className="text-2xl break-words">{name}</h2>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      <BuildingTiles slug={slug} />
      <RecommendedSection slug={slug} />
      <SpacesPreview slug={slug} />
      <RoomsPreview slug={slug} />
      <BuildingFacts
        entrances={entrances}
        entrancesKnown={data.loaded && !data.error}
        rampAccess={profile.data?.rampAccess ?? null}
        elevatorAccess={profile.data?.elevatorAccess ?? null}
      />
      {plans?.length ? <FloorSwitcher floors={plans} floor={floor} onChange={setFloor} /> : null}
    </div>
  );
}

// The screen draws its own back, heart and close, so the selection panel
// doesn't add a second row of the same controls.
export const BuildingPanelScreen = Object.assign(BuildingScreen, { ownsChrome: true });
