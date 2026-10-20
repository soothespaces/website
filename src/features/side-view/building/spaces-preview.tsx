"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { NoiseBadge } from "@/components/ui/noise-badge";
import { SectionHeader } from "@/components/ui/section-header";
import { SpaceTagLine } from "@/components/ui/space-tag-line";
import { useMapState } from "@/features/map/map-state";
import { spaceTagWords } from "@/features/spaces/space-tags";
import { useSession } from "@/lib/auth/use-session";
import { rankSpaces } from "@/lib/ranking";
import { useStudyPreferences } from "@/lib/settings/settings-provider";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { hasStudyPreferences, seeAllSpaces } from "./copy";
import { photoSources } from "./photos";
import { useBuildingPhotos, useSpaceDetails } from "./queries";
import { catalog } from "./recommended";

// Three spaces, ranked the same way as Recommended. Without preferences the
// order falls through to the name. See all opens the Spaces screen.
export function SpacesPreview({ slug }: { slug: string | null }) {
  const { data, push, select, groupSize } = useMapState();
  const session = useSession();
  const { study, ready } = useStudyPreferences();
  const details = useSpaceDetails(slug);
  const photos = useBuildingPhotos(slug);
  const chosen = ready && !!session.user && hasStudyPreferences(study);
  const spaces = useMemo(() => catalog(slug, data.spaces, details.data), [slug, data.spaces, details.data]);
  const ranked = useMemo(
    () => rankSpaces(spaces, chosen ? { preferences: study, groupSize: groupSize ?? undefined } : { groupSize: groupSize ?? undefined }),
    [spaces, chosen, study, groupSize],
  );

  if (!slug) return null;
  if (!data.loaded) {
    return <p className="text-sm text-muted-foreground">Loading study spaces…</p>;
  }
  if (ranked.length === 0) return null;

  const env = getSupabaseEnv();
  const preview = ranked.slice(0, 3);

  return (
    <section className="flex flex-col gap-1">
      <SectionHeader
        title="Study spaces"
        action={{ label: seeAllSpaces(ranked.length), onClick: () => push({ kind: "spaces", slug }) }}
      />
      <ul>
        {preview.map((result) => {
          const space = result.space;
          const photo = photos.data.find((item) => item.spaceId === space.id);
          const tags = spaceTagWords({ light_level: space.light_level, features: space.features });
          const sources = photo && env ? photoSources(env.url, photo.pathPrefix, photo.widths) : null;
          return (
            <li key={space.slug} className="border-b border-border">
              <Button
                variant="ghost"
                onClick={() => select({ kind: "space", slug: space.slug })}
                className="h-auto min-h-11 w-full items-center justify-start gap-3 whitespace-normal rounded-none px-1 py-3 text-left font-normal"
              >
                <span className="size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {sources ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sources.src}
                      srcSet={sources.srcSet || undefined}
                      sizes="3.5rem"
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : null}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold">{space.name}</span>
                  <SpaceTagLine tags={tags} />
                  {space.floor_label ? <span className="text-xs text-muted-foreground">{space.floor_label}</span> : null}
                </span>
                {space.noise_level ? (
                  <span className="shrink-0">
                    <NoiseBadge level={space.noise_level} size="sm" />
                  </span>
                ) : null}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
