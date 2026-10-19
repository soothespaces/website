import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { SpaceEditor } from "@/features/admin-spaces";
import { getSpaceBuildings } from "@/features/admin-spaces/data";

export const metadata: Metadata = {
  title: "Add a space",
};

export default async function NewSpacePage() {
  const buildings = await getSpaceBuildings();
  return (
    <ContentPage
      title="Add a space"
      intro={
        <>
          For a study space the Library and MGuide don&apos;t list, like part of a floor or a computer lab.{" "}
          <Link href="/admin/spaces" className="underline">
            All spaces
          </Link>
        </>
      }
    >
      <SpaceEditor buildings={buildings} />
    </ContentPage>
  );
}
