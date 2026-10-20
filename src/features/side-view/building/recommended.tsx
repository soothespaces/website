"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { NoiseBadge } from "@/components/ui/noise-badge";
import { SectionHeader } from "@/components/ui/section-header";
import { useMapState } from "@/features/map/map-state";
import type { SpaceSummary } from "@/features/spaces";
import { loginHref, loginHrefFor } from "@/lib/auth/paths";
import { useSession } from "@/lib/auth/use-session";
import { rankSpaces } from "@/lib/ranking";
import { useStudyPreferences } from "@/lib/settings/settings-provider";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { hasStudyPreferences } from "./copy";
import { photoSources } from "./photos";
import { useBuildingPhotos, useSpaceDetails, type ListedPhoto } from "./queries";

type CatalogSpace = SpaceSummary & {
  id?: string;
  light_level?: "dim" | "moderate" | "bright" | null;
  floor?: number | null;
  capacity?: number | null;
};

// Top three in this building when someone has saved study preferences.
// Signed out, or signed in with the defaults, gets the prompt instead.
// Preferences only sort; they never drop a space.
export function RecommendedSection({ slug }: { slug: string | null }) {
  const { data, push, select, groupSize } = useMapState();
  const session = useSession();
  const { study, ready } = useStudyPreferences();
  const details = useSpaceDetails(slug);
  const photos = useBuildingPhotos(slug);
  const pathname = usePathname();
  const chosen = hasStudyPreferences(study);

  const spaces = useMemo(() => catalog(slug, data.spaces, details.data), [slug, data.spaces, details.data]);
  const ranked = useMemo(
    () => (chosen ? rankSpaces(spaces, { preferences: study, groupSize: groupSize ?? undefined }) : []),
    [chosen, spaces, study, groupSize],
  );

  if (!slug) return null;

  const refine = () => push({ kind: "preferences" });

  if (session.loading || !ready) {
    return (
      <section aria-busy="true" className="flex flex-col gap-3">
        <SectionHeader title="Recommended" action={{ label: "Refine", onClick: refine }} />
        <p className="text-sm text-muted-foreground">Loading recommendations…</p>
      </section>
    );
  }

  if (!session.user || !chosen) {
    return (
      <section className="flex flex-col gap-3">
        <SectionHeader title="Recommended" action={{ label: "Refine", onClick: refine }} />
        <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-4">
          <div>
            <h3 className="text-base">Log in to see recommended spaces</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {"Tell us how you like to study and we'll pick spots for you."}
            </p>
          </div>
          {session.user ? (
            <Button size="sm" onClick={refine}>
              Set preferences
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link
                href={loginHref(pathname)}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                  event.preventDefault();
                  window.location.assign(loginHrefFor(window.location.pathname, window.location.search));
                }}
              >
                Sign in
              </Link>
            </Button>
          )}
        </div>
      </section>
    );
  }

  if (!data.loaded) {
    return (
      <section aria-busy="true" className="flex flex-col gap-3">
        <SectionHeader title="Recommended" action={{ label: "Refine", onClick: refine }} />
        <p className="text-sm text-muted-foreground">Loading recommendations…</p>
      </section>
    );
  }

  const top = ranked.slice(0, 3);
  if (top.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title="Recommended" action={{ label: "Refine", onClick: refine }} />
      <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
        {top.map((result) => {
          const space = result.space;
          const photo = photos.data.find((item) => item.spaceId === space.id);
          const floor = floorLine(space.name, space.floor_label);
          return (
            <li key={space.slug} className="w-3/5 shrink-0 snap-start">
              <Button
                variant="ghost"
                onClick={() => select({ kind: "space", slug: space.slug })}
                className="h-auto w-full flex-col items-stretch gap-2 whitespace-normal rounded-xl border border-border bg-card p-0 text-left font-normal hover:bg-accent"
              >
                <PhotoBand photo={photo} />
                <span className="flex flex-col gap-1 px-3 pb-3">
                  <span className="text-sm font-semibold">{space.name}</span>
                  {floor ? <span className="text-xs text-muted-foreground">{floor}</span> : null}
                  {space.noise_level ? (
                    <span>
                      <NoiseBadge level={space.noise_level} size="sm" />
                    </span>
                  ) : null}
                  {result.matchesLine ? <span className="text-xs text-muted-foreground">{result.matchesLine}</span> : null}
                </span>
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function floorLine(name: string, label: string | null): string | null {
  if (!label) return null;
  if (label.trim().toLowerCase() === name.trim().toLowerCase()) return null;
  return label;
}

function PhotoBand({ photo }: { photo: ListedPhoto | undefined }) {
  const env = getSupabaseEnv();
  return (
    <span className="block aspect-[4/3] w-full overflow-hidden rounded-t-xl bg-muted">
      {photo && env ? <BandImage photo={photo} supabaseUrl={env.url} /> : null}
    </span>
  );
}

function BandImage({ photo, supabaseUrl }: { photo: ListedPhoto; supabaseUrl: string }) {
  const sources = photoSources(supabaseUrl, photo.pathPrefix, photo.widths);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sources.src}
        srcSet={sources.srcSet || undefined}
        sizes="12rem"
        alt=""
        width={photo.width}
        height={photo.height}
        className="h-full w-full object-cover"
      />
    </>
  );
}

function catalog(
  slug: string | null,
  spaces: SpaceSummary[],
  details: { id: string; slug: string; lightLevel: CatalogSpace["light_level"]; floor: number | null; capacity: number | null }[],
): CatalogSpace[] {
  if (!slug) return [];
  const extra = new Map(details.map((detail) => [detail.slug, detail]));
  return spaces
    .filter((space) => space.building?.slug === slug)
    .map((space) => {
      const more = extra.get(space.slug);
      return {
        ...space,
        id: more?.id,
        light_level: more?.lightLevel ?? null,
        floor: more?.floor ?? null,
        capacity: more?.capacity ?? null,
      };
    });
}

export { catalog };
