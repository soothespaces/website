import type { Metadata } from "next";
import { SettingsForm } from "@/components/settings/settings-form";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Account preferences",
  description: "Theme, contrast, text size, motion, and your default view.",
  robots: { index: false },
};

export default function SettingsPage() {
  return (
    <ContentPage
      title="Account preferences"
      intro="Theme, contrast, text size, motion, and the view that opens first. Changes apply right away."
    >
      <SettingsForm />
    </ContentPage>
  );
}
