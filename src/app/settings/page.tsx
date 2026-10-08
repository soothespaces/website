import type { Metadata } from "next";
import { ContentPage, PlaceholderNotice } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Account preferences",
  robots: { index: false },
};

export default function SettingsPage() {
  return (
    <ContentPage
      title="Account preferences"
      intro="Display settings and the needs you want the map to prioritize."
    >
      <PlaceholderNotice>
        Theme, high contrast, text size, reduced motion and your default view
        will live here.
      </PlaceholderNotice>
    </ContentPage>
  );
}
