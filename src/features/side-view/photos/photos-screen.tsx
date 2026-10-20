"use client";

import { useMemo, useState } from "react";
import { Chip, ChipGroup } from "@/components/ui/chip-group";
import { DetailScreen } from "@/components/ui/detail-screen";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { useMapState } from "@/features/map/map-state";
import type { PanelScreenProps } from "../registry";
import { PhotoGrid } from "./photo-grid";
import { classifyPhoto, filterPhotos, groupPhotos, photoCountLabel, type PhotoFilter } from "./photo-model";
import { useBuildingPhotos } from "./use-building-photos";

const FILTERS: { value: PhotoFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "visitors", label: "From visitors" },
  { value: "official", label: "Official" },
];

function isFilter(value: string): value is PhotoFilter {
  return value === "all" || value === "visitors" || value === "official";
}

// Visitor uploads are a later flow. The board's "Add a photo" button stays
// hidden until that exists.
export function PhotosScreen({ route }: PanelScreenProps) {
  const { back, stack, data } = useMapState();
  const [filter, setFilter] = useState<PhotoFilter>("all");
  const slug = route.kind === "photos" ? route.slug : "";
  const spaceSlug = route.kind === "photos" ? route.spaceId : undefined;
  const loadedPhotos = useBuildingPhotos(slug, spaceSlug);

  const classified = useMemo(() => loadedPhotos.photos.map(classifyPhoto), [loadedPhotos.photos]);
  const allowed = useMemo(() => classified.filter((photo) => !photo.hidden), [classified]);
  const shown = useMemo(() => filterPhotos(classified, filter), [classified, filter]);
  const groups = useMemo(() => groupPhotos(shown), [shown]);

  if (route.kind !== "photos") return null;

  const mapBuilding = data.buildingsBySlug.get(route.slug);
  const buildingName = loadedPhotos.buildingName || mapBuilding?.name || "Building";
  const parent = stack.at(-2);
  let backTo = "Home";
  if (parent?.kind === "building") backTo = buildingName;
  else if (parent?.kind === "space") {
    backTo = data.spaces.find((space) => space.slug === parent.id)?.name ?? "Space";
  }

  const title = loadedPhotos.loaded && !loadedPhotos.error ? photoCountLabel(allowed.length) : "Photos";

  return (
    <DetailScreen title={title} subtitle={buildingName} backTo={backTo} onBack={back} className="min-h-0 flex-1">
      <div className="flex flex-col gap-3">
        <ChipGroup
          type="single"
          label="Which photos"
          labelHidden
          value={filter}
          onValueChange={(value) => {
            if (isFilter(value)) setFilter(value);
          }}
        >
          {FILTERS.map((item) => (
            <Chip key={item.value} value={item.value}>
              {item.label}
            </Chip>
          ))}
        </ChipGroup>
        <PhotoBody
          loaded={loadedPhotos.loaded}
          error={loadedPhotos.error}
          filter={filter}
          groups={groups}
          total={shown.length}
        />
      </div>
    </DetailScreen>
  );
}

function PhotoBody({
  loaded,
  error,
  filter,
  groups,
  total,
}: {
  loaded: boolean;
  error: string | null;
  filter: PhotoFilter;
  groups: ReturnType<typeof groupPhotos>;
  total: number;
}) {
  if (!loaded) {
    return (
      <div role="status" className="flex flex-col gap-3">
        <span className="sr-only">Loading photos</span>
        <Skeleton className="aspect-[4/3] w-full" />
        <Skeleton className="aspect-[4/3] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <p role="alert" className="text-sm text-muted-foreground">
        {error}
      </p>
    );
  }

  if (total === 0) {
    const description =
      filter === "visitors"
        ? "No visitor photos yet."
        : filter === "official"
          ? "No official photos yet."
          : "No photos yet.";
    return <EmptyState title={description} />;
  }

  return <PhotoGrid groups={groups} total={total} />;
}
