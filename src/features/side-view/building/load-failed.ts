"use client";

import {
  useBookableFloors,
  useBuildingPhotos,
  useBuildingProfile,
  useSpaceDetails,
} from "./queries";

/**
 * True when a shared building read failed: its profile, spaces, photos or
 * bookable floors. These hooks share one cache with the sections, so this
 * adds no requests. Hours, busyness and rooms say so in their own sections.
 */
export function useBuildingLoadFailed(slug: string | null): boolean {
  const profile = useBuildingProfile(slug);
  const photos = useBuildingPhotos(slug);
  const details = useSpaceDetails(slug);
  const floors = useBookableFloors(slug);
  return profile.failed || photos.failed || details.failed || floors.failed;
}
