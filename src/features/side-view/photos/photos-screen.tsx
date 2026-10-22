"use client";

import { useMemo, useState } from "react";
import { Chip, ChipGroup } from "@/components/ui/chip-group";
import { DetailScreen } from "@/components/ui/detail-screen";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { useMapState } from "@/features/map/map-state";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { PanelScreenProps } from "../registry";
import { PhotoGrid } from "./photo-grid";
import { PhotoViewer } from "./photo-viewer";
import {
  classifyPhoto,
  filterPhotos,
  orderPhotos,
  photoCountLabel,
  type ClassifiedPhoto,
  type PhotoFilter,
} from "./photo-model";
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
  const [openId, setOpenId] = useState<string | null>(null);
  const slug = route.kind === "photos" ? route.slug : "";
  const spaceSlug = route.kind === "photos" ? route.spaceId : undefined;
  const loadedPhotos = useBuildingPhotos(slug, spaceSlug);

  const classified = useMemo(() => loadedPhotos.photos.map(classifyPhoto), [loadedPhotos.photos]);
  const allowed = useMemo(() => filterPhotos(classified, "all"), [classified]);
  const shown = useMemo(() => orderPhotos(filterPhotos(classified, filter)), [classified, filter]);
  const openIndex = shown.findIndex((photo) => photo.id === openId);
  const supabaseUrl = getSupabaseEnv()?.url;

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
          photos={shown}
          onOpen={setOpenId}
        />
      </div>
      {supabaseUrl ? (
        <PhotoViewer
          photos={shown}
          index={openIndex < 0 ? 0 : openIndex}
          open={openIndex >= 0}
          supabaseUrl={supabaseUrl}
          onOpenChange={(next) => {
            if (!next) setOpenId(null);
          }}
          onIndexChange={(next) => {
            const photo = shown[next];
            if (photo) setOpenId(photo.id);
          }}
        />
      ) : null}
    </DetailScreen>
  );
}

function PhotoBody({
  loaded,
  error,
  filter,
  photos,
  onOpen,
}: {
  loaded: boolean;
  error: string | null;
  filter: PhotoFilter;
  photos: ClassifiedPhoto[];
  onOpen: (id: string) => void;
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

  if (photos.length === 0) {
    const description =
      filter === "visitors"
        ? "No visitor photos yet."
        : filter === "official"
          ? "No official photos yet."
          : "No photos yet.";
    return <EmptyState title={description} />;
  }

  return <PhotoGrid photos={photos} onOpen={onOpen} />;
}
