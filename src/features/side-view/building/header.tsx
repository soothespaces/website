"use client";

import { Button } from "@/components/ui/button";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { CloseIcon, HeartIcon } from "@/components/ui/icons";
import { PanelBackButton } from "@/components/ui/panel-back-button";
import { useSession } from "@/lib/auth/use-session";
import { useFavorites } from "@/lib/data/favorites";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { photoCount } from "./copy";
import { photoSources } from "./photos";
import { useBuildingPhotos, type ListedPhoto } from "./queries";

const iconButton = "text-muted-foreground hover:text-foreground";

// Back, the favorite heart, and Close, then the photo mosaic. A building
// with no listed photos keeps the row and skips the mosaic, so there is no
// empty frame.
export function BuildingHeader({
  slug,
  name,
  onBack,
  onClose,
  onOpenPhotos,
}: {
  slug: string | null;
  name: string;
  onBack: () => void;
  onClose: () => void;
  onOpenPhotos: () => void;
}) {
  const session = useSession();
  const favorites = useFavorites();
  const target = slug ? ({ kind: "building", buildingSlug: slug } as const) : null;
  const pressed = target ? favorites.isFavorite(target) : false;
  const photos = useBuildingPhotos(slug);
  const listed = photos.data.filter((photo) => photo.kind !== "panorama");
  const frames = (listed.length > 0 ? listed : photos.data).slice(0, 3);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <PanelBackButton label="Back" onClick={onBack} />
        <div className="flex items-center">
          {slug ? (
            session.loading ? (
              <Button variant="ghost" size="icon" shape="circle" disabled aria-label={`Add ${name} to your spots`}>
                <HeartIcon />
              </Button>
            ) : (
              <FavoriteButton
                name={name}
                pressed={pressed}
                signedIn={favorites.signedIn}
                onPressedChange={(next) => {
                  if (!target) return;
                  void (next ? favorites.add(target) : favorites.remove(target));
                }}
              />
            )
          ) : null}
          <Button variant="ghost" size="icon" shape="circle" onClick={onClose} className={iconButton} aria-label="Close">
            <CloseIcon />
          </Button>
        </div>
      </div>
      {photos.ready && frames.length > 0 ? (
        <PhotoMosaic photos={frames} total={photos.data.length} onOpen={onOpenPhotos} />
      ) : null}
    </div>
  );
}

function PhotoMosaic({ photos, total, onOpen }: { photos: ListedPhoto[]; total: number; onOpen: () => void }) {
  const env = getSupabaseEnv();
  if (!env) return null;
  const pill = (
    <Button
      variant="ghost"
      size="sm"
      onClick={onOpen}
      className="absolute right-2 bottom-2 z-10 h-auto min-h-9 rounded-full bg-foreground px-3 text-background hover:bg-foreground/90"
    >
      {photoCount(total)}
    </Button>
  );
  if (photos.length === 1) {
    return (
      <div className="relative h-40 overflow-hidden rounded-xl bg-muted">
        <Frame photo={photos[0]} supabaseUrl={env.url} sizes="24rem" />
        {pill}
      </div>
    );
  }
  const stacked = photos.length >= 3;
  return (
    <div className={`grid h-40 gap-1.5 ${stacked ? "grid-cols-[1.4fr_1fr] grid-rows-2" : "grid-cols-[1.4fr_1fr]"}`}>
      <div className={`relative min-h-0 overflow-hidden rounded-xl bg-muted ${stacked ? "row-span-2" : ""}`}>
        <Frame photo={photos[0]} supabaseUrl={env.url} sizes="16rem" />
      </div>
      <div className="relative min-h-0 overflow-hidden rounded-xl bg-muted">
        <Frame photo={photos[1]} supabaseUrl={env.url} sizes="10rem" />
        {photos.length === 2 ? pill : null}
      </div>
      {stacked ? (
        <div className="relative min-h-0 overflow-hidden rounded-xl bg-muted">
          <Frame photo={photos[2]} supabaseUrl={env.url} sizes="10rem" />
          {pill}
        </div>
      ) : null}
    </div>
  );
}

function Frame({ photo, supabaseUrl, sizes }: { photo: ListedPhoto; supabaseUrl: string; sizes: string }) {
  const sources = photoSources(supabaseUrl, photo.pathPrefix, photo.widths);
  return (
    <>
      {/* Stored widths already exist; a loader would only re-encode them. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sources.src}
        srcSet={sources.srcSet || undefined}
        sizes={sizes}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <span className="sr-only">Photo credit: {photo.credit}</span>
    </>
  );
}
