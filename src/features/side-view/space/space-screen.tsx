"use client";

import { useEffect, useId, type KeyboardEvent } from "react";
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
  isBlockedPhoto,
  photoCountLabel,
  placeLine,
  spaceBackLabel,
  spaceParagraph,
  spacePhotosRoute,
  visiblePhotoCount,
  whatsHereLabels,
} from "./format";
import { SpaceHeading, SpaceToolbar, type SpaceHeaderBuilding } from "./header";
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
  const { data, stack, canGoBack, back, clear, push, reset, setFloor, floorPlans } = useMapState();
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

  // A pasted space link has nothing under it. Back goes to the space's
  // building, the screen it would have come from (QA-061); Close still clears.
  const home = record?.building ?? listed?.building ?? null;
  const onBack = () => {
    if (canGoBack) back();
    else if (home) {
      const known = data.buildingsBySlug.get(home.slug);
      reset({ kind: "building", slug: home.slug, recordNumber: known?.recordNumber ?? null, name: home.name });
    } else clear();
  };
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    onBack();
  }

  // The map opens on the space's own floor, not the building's first plan
  // (QA-082). The Space board has no floor switcher; the building has one.
  const recordSlug = record?.slug ?? null;
  const spaceFloor = record ? (locationFloors(record.locations)[0] ?? null) : null;
  const homePlans = home ? floorPlans.get(home.slug) : undefined;
  const hasSpacePlan = spaceFloor != null && Boolean(homePlans?.some((plan) => plan.floor === spaceFloor));
  useEffect(() => {
    if (recordSlug && hasSpacePlan) setFloor(spaceFloor);
  }, [recordSlug, hasSpacePlan, spaceFloor, setFloor]);

  if (route.kind !== "space") return null;

  if (!listed && !record) {
    if (detail.error) {
      return (
        <section onKeyDown={onKeyDown}>
          <Note>{detail.error}</Note>
        </section>
      );
    }
    if (data.loaded && detail.loaded) {
      return (
        <section onKeyDown={onKeyDown}>
          <Note>This space isn’t listed.</Note>
        </section>
      );
    }
    return (
      <section onKeyDown={onKeyDown} className="flex flex-col gap-3 px-1">
        <div role="status">
          <span className="sr-only">Loading…</span>
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="aspect-[4/3] w-full rounded-xl" />
        </div>
      </section>
    );
  }

  const name = record?.name ?? listed?.name ?? "";
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
  const showsLibraryPhoto = Boolean(record?.imageUrl && !isBlockedPhoto({ sourceUrl: record.imageUrl }));
  const photo = record ? heroPhoto(record) : null;
  const photoLabel = record ? photoCountLabel(visiblePhotoCount(record.photoCount, showsLibraryPhoto)) : null;
  const locationLine = placeLine(buildingDisplayName(building), record?.floorLabel ?? listed?.floor_label ?? null);
  const placedFloors = record ? locationFloors(record.locations) : [];
  const floorSubtitle = record ? floorPlanSubtitle(placedFloors) : null;
  const parent = stack.at(-2);
  const onPhotos =
    record && building && photoLabel ? () => push(spacePhotosRoute(building.slug, record.slug)) : null;
  const onShowFloor =
    record && placedFloors.length > 0
      ? () => {
          setFloor(placedFloors[0] ?? null);
        }
      : null;

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={!detail.loaded}
      onKeyDown={onKeyDown}
      data-detail-scroll=""
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-1 pb-2"
    >
      <SpaceToolbar
        name={name}
        spaceId={record?.id ?? null}
        backLabel={spaceBackLabel(parent ?? (building ? { kind: "building", slug: building.slug } : undefined), buildingDisplayName(building))}
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
      <SpaceHeading
        titleId={titleId}
        name={name}
        noiseLevel={record?.noiseLevel ?? listed?.noise_level ?? null}
        lat={record?.lat ?? listed?.lat ?? null}
        lng={record?.lng ?? listed?.lng ?? null}
        building={building}
        locationLine={locationLine}
        hoursTarget={detail.loaded ? { buildingSlug: building?.slug ?? null, spaceId: record?.id ?? null } : null}
      />
      {paragraph ? <p className="text-sm whitespace-pre-line">{paragraph}</p> : null}
      <WhatItsLike rows={rows} />
      <CheckInCard spaceSlug={route.id} spaceId={record?.id} />
      <WhatsHere labels={whatsHereLabels(features, rows?.map((row) => row.id) ?? null)} />
      {floorSubtitle ? <FloorPlanCard subtitle={floorSubtitle} onShow={onShowFloor} /> : null}
    </section>
  );
}
