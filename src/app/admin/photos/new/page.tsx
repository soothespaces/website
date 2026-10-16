import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { PhotoEditor } from "@/features/admin-photos";
import { getBuildingOptions } from "@/features/admin-photos/data";
import { requireSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "Upload a photo",
};

export default async function NewPhotoPage() {
  const buildings = await getBuildingOptions();
  return (
    <ContentPage
      title="Upload a photo"
      intro={
        <>
          Tag it to a building, or to a floor, room or spot on one of its floor plans.{" "}
          <Link href="/admin/photos" className="underline">
            All photos
          </Link>
        </>
      }
    >
      <PhotoEditor buildings={buildings} supabaseUrl={requireSupabaseEnv().url} />
    </ContentPage>
  );
}
