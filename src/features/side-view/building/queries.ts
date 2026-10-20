"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { isGooglePhoto } from "./copy";

export type BuildingProfile = {
  name: string;
  shortName: string | null;
  acronym: string | null;
  address: string | null;
  rampAccess: string | null;
  elevatorAccess: string | null;
  floors: number | null;
};

export type ListedPhoto = {
  id: string;
  alt: string;
  pathPrefix: string;
  widths: number[];
  width: number;
  height: number;
  sortOrder: number;
  spaceId: string | null;
  credit: string;
  kind: string;
};

export type SpaceDetail = {
  id: string;
  slug: string;
  lightLevel: "dim" | "moderate" | "bright" | null;
  floor: number | null;
  capacity: number | null;
};

const NO_PHOTOS: ListedPhoto[] = [];
const NO_DETAILS: SpaceDetail[] = [];
const NO_FLOORS: number[] = [];

function useCached<T>(slug: string | null, cache: Map<string, T>, load: (slug: string) => Promise<T>, empty: T) {
  const [tick, setTick] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!slug || cache.has(slug) || !getSupabaseEnv()) return;
    let cancelled = false;
    load(slug)
      .then((value) => {
        cache.set(slug, value);
        if (!cancelled) setTick((n) => n + 1);
      })
      .catch((error: unknown) => {
        // A failed read is not "nothing there". Leave it out of the cache so
        // the next time this screen mounts it tries again.
        console.error(error);
        if (!cancelled) setFailed(slug);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, cache, load, empty]);
  void tick;
  if (!slug || !getSupabaseEnv()) return { data: empty, ready: true };
  if (failed === slug && !cache.has(slug)) return { data: empty, ready: true };
  if (!cache.has(slug)) return { data: empty, ready: false };
  return { data: cache.get(slug) ?? empty, ready: true };
}

function share<T>(load: (slug: string) => Promise<T>) {
  const pending = new Map<string, Promise<T>>();
  return (slug: string) => {
    const existing = pending.get(slug);
    if (existing) return existing;
    const promise = load(slug).finally(() => pending.delete(slug));
    pending.set(slug, promise);
    return promise;
  };
}

const profiles = new Map<string, BuildingProfile | null>();
const photos = new Map<string, ListedPhoto[]>();
const details = new Map<string, SpaceDetail[]>();
const floors = new Map<string, number[]>();

async function fetchProfile(slug: string): Promise<BuildingProfile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("buildings")
    .select("name, short_name, acronym, address, ramp_access, elevator_access, floors")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    name: data.name,
    shortName: data.short_name,
    acronym: data.acronym,
    address: data.address,
    rampAccess: data.ramp_access,
    elevatorAccess: data.elevator_access,
    floors: data.floors,
  };
}

const PHOTO_COLUMNS =
  "id, alt, path_prefix, widths, width, height, sort_order, space_id, credit, kind, source_url, license";

function listedPhoto(photo: {
  id: string;
  alt: string;
  path_prefix: string;
  widths: number[];
  width: number;
  height: number;
  sort_order: number;
  space_id: string | null;
  credit: string;
  kind: string;
  source_url: string | null;
  license: string;
}): ListedPhoto | null {
  if (isGooglePhoto({ sourceUrl: photo.source_url, license: photo.license, credit: photo.credit })) return null;
  return {
    id: photo.id,
    alt: photo.alt,
    pathPrefix: photo.path_prefix,
    widths: photo.widths,
    width: photo.width,
    height: photo.height,
    sortOrder: photo.sort_order,
    spaceId: photo.space_id,
    credit: photo.credit,
    kind: photo.kind,
  };
}

async function fetchPhotos(slug: string): Promise<ListedPhoto[]> {
  const supabase = createClient();
  const { data: spaces, error: spaceError } = await supabase
    .from("spaces")
    .select("id")
    .eq("building_slug", slug)
    .eq("is_listed", true);
  if (spaceError) throw spaceError;
  const ids = (spaces ?? []).map((space) => space.id);
  const buildingPhotos = supabase.from("photos").select(PHOTO_COLUMNS).eq("is_listed", true).eq("building_slug", slug);
  const spacePhotos = ids.length
    ? supabase.from("photos").select(PHOTO_COLUMNS).eq("is_listed", true).in("space_id", ids)
    : null;
  const [buildingResult, spaceResult] = await Promise.all([
    buildingPhotos,
    spacePhotos ?? Promise.resolve({ data: [], error: null }),
  ]);
  if (buildingResult.error) throw buildingResult.error;
  if (spaceResult.error) throw spaceResult.error;
  const merged = new Map<string, ListedPhoto>();
  for (const photo of [...(buildingResult.data ?? []), ...(spaceResult.data ?? [])]) {
    const listed = listedPhoto(photo);
    if (listed) merged.set(listed.id, listed);
  }
  return [...merged.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

async function fetchDetails(slug: string): Promise<SpaceDetail[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("spaces")
    .select("id, slug, light_level, floor, capacity")
    .eq("building_slug", slug)
    .eq("is_listed", true);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    lightLevel: row.light_level,
    floor: row.floor,
    capacity: row.capacity,
  }));
}

async function fetchFloors(slug: string): Promise<number[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("bookable_items").select("floor").eq("building_slug", slug).eq("is_listed", true);
  if (error) throw error;
  return (data ?? []).flatMap((row) => (row.floor == null ? [] : [row.floor]));
}

const fetchProfileOnce = share(fetchProfile);
const fetchPhotosOnce = share(fetchPhotos);
const fetchDetailsOnce = share(fetchDetails);
const fetchFloorsOnce = share(fetchFloors);

export function useBuildingProfile(slug: string | null) {
  return useCached(slug, profiles, fetchProfileOnce, null);
}

export function useBuildingPhotos(slug: string | null) {
  return useCached(slug, photos, fetchPhotosOnce, NO_PHOTOS);
}

export function useSpaceDetails(slug: string | null) {
  return useCached(slug, details, fetchDetailsOnce, NO_DETAILS);
}

export function useBookableFloors(slug: string | null) {
  return useCached(slug, floors, fetchFloorsOnce, NO_FLOORS);
}
