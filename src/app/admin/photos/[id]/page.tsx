import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/content-page";
import { PhotoEditor } from "@/features/admin-photos";
import { getBuildingOptions, getPhoto } from "@/features/admin-photos/data";
import { requireSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "Photo",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PhotoPage({ params, searchParams }: PageProps<"/admin/photos/[id]">) {
  const { id } = await params;
  const { uploaded } = await searchParams;
  if (!UUID.test(id)) notFound();
  const [photo, buildings] = await Promise.all([getPhoto(id), getBuildingOptions()]);
  if (!photo) notFound();
  const building = buildings.find((b) => b.slug === photo.buildingSlug);
  return (
    <ContentPage
      title={building?.name ?? "Photo"}
      intro={
        <>
          {uploaded ? "Uploaded. " : null}
          Change what it&apos;s tagged to, or its details.{" "}
          <Link href="/admin/photos/new" className="underline">
            Upload another
          </Link>{" "}
          ·{" "}
          <Link href="/admin/photos" className="underline">
            All photos
          </Link>
        </>
      }
    >
      <PhotoEditor key={photo.id} buildings={buildings} photo={photo} supabaseUrl={requireSupabaseEnv().url} />
    </ContentPage>
  );
}
