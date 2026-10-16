import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { getBuildingOptions, getPhotos, PAGE_SIZE } from "@/features/admin-photos/data";
import { describeTags, photoUrl } from "@/features/admin-photos/photo";
import { requireSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "Photos",
};

export default async function PhotosAdminPage({ searchParams }: PageProps<"/admin/photos">) {
  const params = await searchParams;
  const building = typeof params.building === "string" ? params.building : "";
  const uploaded = params.uploaded === "1";
  const page = Math.max(0, Number(params.page) || 0);
  const [buildings, { photos, total }] = await Promise.all([
    getBuildingOptions(),
    getPhotos({ building: building || undefined, uploaded, page }),
  ]);
  const names = new Map(buildings.map((b) => [b.slug, b.name]));
  const { url } = requireSupabaseEnv();
  const pages = Math.ceil(total / PAGE_SIZE);
  const href = (p: number) => {
    const q = new URLSearchParams();
    if (building) q.set("building", building);
    if (uploaded) q.set("uploaded", "1");
    if (p) q.set("page", String(p));
    const s = q.toString();
    return s ? `/admin/photos?${s}` : "/admin/photos";
  };

  return (
    <ContentPage
      title="Photos"
      intro={
        <>
          Building photos, newest first, including hidden ones. Open a photo to re-tag it.{" "}
          {params.deleted ? "Deleted. " : null}
          <Link href="/admin/floors" className="underline">
            Floor plans
          </Link>
        </>
      }
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <form className="flex flex-wrap items-end gap-3 text-sm" action="/admin/photos">
          <label className="flex flex-col gap-1">
            <span className="font-medium">Building</span>
            <select name="building" defaultValue={building} className="h-11 w-72 rounded-md border border-input bg-background px-3">
              <option value="">All buildings</option>
              {buildings.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex h-11 items-center gap-2">
            <input type="checkbox" name="uploaded" value="1" defaultChecked={uploaded} className="size-4 accent-primary" />
            Uploaded here only
          </label>
          <button type="submit" className="h-11 rounded-md border border-input px-4 hover:bg-accent">
            Filter
          </button>
        </form>
        <Link href="/admin/photos/new" className="rounded-md bg-primary px-4 py-2.5 font-medium text-primary-foreground">
          Upload a photo
        </Link>
      </div>

      {photos.length ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-4">
          {photos.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/photos/${p.id}`} className="flex flex-col gap-2 rounded-md border border-input p-2 hover:bg-accent">
                {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized Supabase files */}
                <img
                  src={photoUrl(url, p.pathPrefix, p.widths[0])}
                  alt={p.alt}
                  width={p.width}
                  height={p.height}
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded object-cover"
                />
                <span className="px-1 text-sm font-medium">{names.get(p.buildingSlug) ?? p.buildingSlug}</span>
                <span className="px-1 text-sm text-muted-foreground">
                  {describeTags(p)}
                  {p.kind === "panorama" ? ", 360°" : ""}
                  {p.isListed ? "" : ", hidden"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">No photos match.</p>
      )}

      {pages > 1 ? (
        <nav aria-label="Pages" className="flex items-center gap-4 text-sm">
          {page > 0 ? <Link href={href(page - 1)} className="underline">Newer</Link> : null}
          <span className="text-muted-foreground">
            Page {page + 1} of {pages}
          </span>
          {page + 1 < pages ? <Link href={href(page + 1)} className="underline">Older</Link> : null}
        </nav>
      ) : null}
    </ContentPage>
  );
}
