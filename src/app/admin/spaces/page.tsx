import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { Button } from "@/components/ui/button";
import { getSpaceBuildings, getSpaceRows } from "@/features/admin-spaces/data";
import { SOURCE_LABELS } from "@/features/admin-spaces/space";

export const metadata: Metadata = {
  title: "Spaces",
};

export default async function SpacesAdminPage({ searchParams }: PageProps<"/admin/spaces">) {
  const params = await searchParams;
  const building = typeof params.building === "string" ? params.building : "";
  const [buildings, spaces] = await Promise.all([getSpaceBuildings(), getSpaceRows(building || undefined)]);
  const withSpaces = new Set((await getSpaceRows()).map((s) => s.buildingSlug));

  return (
    <ContentPage
      title="Spaces"
      intro={
        <>
          Every study space, including hidden ones. Open one to set its amenities, brightness and where it is on the
          floor plan. {params.deleted ? "Deleted." : null}
        </>
      }
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <form className="flex flex-wrap items-end gap-3 text-sm" action="/admin/spaces">
          <label className="flex flex-col gap-1">
            <span className="font-medium">Building</span>
            <select name="building" defaultValue={building} className="h-11 w-72 rounded-md border border-input bg-background px-3">
              <option value="">All buildings</option>
              {buildings
                .filter((b) => withSpaces.has(b.slug))
                .map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.name}
                  </option>
                ))}
            </select>
          </label>
          <Button type="submit" variant="outline">
            Filter
          </Button>
        </form>
        <Button asChild>
          <Link href="/admin/spaces/new">Add a space</Link>
        </Button>
      </div>

      {spaces.length ? (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-input">
          {spaces.map((s) => (
            <li key={s.slug}>
              <Link href={`/admin/spaces/${s.slug}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-accent">
                <span className="font-medium">{s.name}</span>
                <span className="text-sm text-muted-foreground">
                  {[
                    s.buildingName,
                    s.floorLabel,
                    SOURCE_LABELS[s.source],
                    s.onMap ? "on the map" : "not on the map",
                    s.edited ? "edited by hand" : null,
                    s.isListed ? null : "hidden",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">No spaces match.</p>
      )}
    </ContentPage>
  );
}
