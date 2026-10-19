import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/content-page";
import { SpaceEditor } from "@/features/admin-spaces";
import { getSpace, getSpaceBuildings } from "@/features/admin-spaces/data";

export const metadata: Metadata = {
  title: "Space",
};

export default async function SpacePage({ params, searchParams }: PageProps<"/admin/spaces/[slug]">) {
  const { slug } = await params;
  const { added } = await searchParams;
  const [space, buildings] = await Promise.all([getSpace(slug), getSpaceBuildings()]);
  if (!space) notFound();
  return (
    <ContentPage
      title={space.name}
      intro={
        <>
          {added ? "Added. " : null}
          Edit what it&apos;s like and where it is.{" "}
          <Link href="/admin/spaces" className="underline">
            All spaces
          </Link>
        </>
      }
    >
      <SpaceEditor key={space.id} buildings={buildings} space={space} />
    </ContentPage>
  );
}
