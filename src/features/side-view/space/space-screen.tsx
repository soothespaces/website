"use client";

import { useId } from "react";
import { Skeleton } from "@/components/ui/feedback";
import { useMapState } from "@/features/map/map-state";
import type { PanelRoute } from "@/features/side-view/panel-route";
import type { SpaceListDensity } from "@/features/spaces";
import type { AttributeSpace } from "@/lib/data/attributes";
import type { SpaceDetail } from "./detail";
import { floorsForPrinters, locationFloors } from "./detail";
import { CheckInCard } from "./check-in-card";
import { FloorPlanCard } from "./floor-plan-card";
import {
  buildingDisplayName,
  floorPlanSubtitle,
  heroPhoto,
  photoCountLabel,
  spaceBackLabel,
  spaceParagraph,
  spacePhotosRoute,
  whatsHereLabels,
} from "./format";
import { SpaceHeader, type SpaceHeaderBuilding } from "./header";
import { SpaceHero } from "./hero";
import { useSpaceDetail } from "./use-space-detail";
import { WhatItsLike, useWhatItsLikeRows } from "./what-its-like";
import { WhatsHere } from "./whats-here";

function attributesOf(space: SpaceDetail): AttributeSpace {
  return {
    noiseLevel: space.noiseLevel,
    lightLevel: space.lightLevel,
    features: space.features,
    capacity: space.capacity,
    source: space.source,
    editedFields: space.editedFields,
    // Open vs enclosed waits on BK2. Leave this unset so the setting row
    // shows seating text only.
  };
}

function Note({ children }: { children: string }) {
  return (
    <p role="status" className="px-1 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

export function SpaceScreen({ route }: { route: PanelRoute; density: SpaceListDensity }) {
  const slug = route.kind === "space" ? route.id : null;
  const titleId = useId();
  const { data, stack, canGoBack, back, clear, push, setFloor } = useMapState();
  const detail = useSpaceDetail(slug);
  const listed = slug ? (data.spaces.find((space) => space.slug === slug) ?? null) : null;
  const record = detail.space;
  const rows = useWhatItsLikeRows(
    record
      ? {
          id: record.id,
          buildingSlug: record.building?.slug ?? listed?.building?.slug ?? null,
          floors: floorsForPrinters(record),
          attributes: attributesOf(record),
        }
      : null,
  );

  if (route.kind !== "space") return null;

  if (!listed && !record) {
    if (detail.error) return <Note>{detail.error}</Note>;
    if (data.loaded && detail.loaded) return <Note>This space isn’t listed.</Note>;
    return (
      <div role="status" className="flex flex-col gap-3 px-1">
        <span className="sr-only">Loading…</span>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="aspect-[4/3] w-full rounded-xl" />
      </div>
    );
  }

  const name = record?.name ?? listed?.name ?? "Study space";
  const building: SpaceHeaderBuilding | null =
    record?.building ??
    (listed?.building
      ? {
          slug: listed.building.slug,
          name: listed.building.name,
          shortName: null,
          lat: listed.building.lat,
          lng: listed.building.lng,
        }
      : null);
  const paragraph = spaceParagraph(record?.summary ?? listed?.summary, record?.description);
  const features = record?.features ?? listed?.features ?? [];
  const photo = record ? heroPhoto(record) : null;
  const photoLabel = record ? photoCountLabel(record.photoCount) : null;
  const placedFloors = record ? locationFloors(record.locations) : [];
  const floorSubtitle = record ? floorPlanSubtitle(placedFloors) : null;
  const parent = stack.at(-2);
  const onBack = () => {
    if (canGoBack) back();
    else clear();
  };
  const onPhotos =
    record && building && photoLabel ? () => push(spacePhotosRoute(building.slug, record.slug)) : null;
  const onShowFloor =
    record && placedFloors.length > 0
      ? () => {
          setFloor(placedFloors[0] ?? null);
        }
      : null;

  return (
    <section aria-labelledby={titleId} aria-busy={!detail.loaded} className="flex min-w-0 flex-col gap-5 px-1 pb-2">
      <SpaceHeader
        titleId={titleId}
        name={name}
        spaceId={record?.id ?? null}
        noiseLevel={record?.noiseLevel ?? listed?.noise_level ?? null}
        lat={record?.lat ?? listed?.lat ?? null}
        lng={record?.lng ?? listed?.lng ?? null}
        building={building}
        hoursTarget={
          detail.loaded ? { buildingSlug: building?.slug ?? null, spaceId: record?.id ?? null } : null
        }
        backLabel={spaceBackLabel(parent, buildingDisplayName(building))}
        onBack={onBack}
      />
      {!detail.loaded ? (
        <div role="status">
          <span className="sr-only">Loading photo…</span>
          <Skeleton className="aspect-[4/3] w-full rounded-xl" />
        </div>
      ) : (
        <SpaceHero photo={photo} photoLabel={photoLabel} onPhotos={onPhotos} />
      )}
      {paragraph ? <p className="text-sm whitespace-pre-line">{paragraph}</p> : null}
      <WhatItsLike rows={rows} />
      <CheckInCard />
      <WhatsHere labels={whatsHereLabels(features, rows?.map((row) => row.id) ?? null)} />
      {floorSubtitle ? <FloorPlanCard subtitle={floorSubtitle} onShow={onShowFloor} /> : null}
    </section>
  );
}
