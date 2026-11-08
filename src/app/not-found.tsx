import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/site";

// QA-070: the 404 names itself in the title and keeps the site's landmarks.
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <ContentPage title="Page not found" intro="There's no page at this address. It may have moved, or the link has a typo.">
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href={ROUTES.map}>Open the map</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </ContentPage>
  );
}
