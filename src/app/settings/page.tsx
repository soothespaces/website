import type { Metadata } from "next";
import { SettingsForm } from "@/components/settings/settings-form";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Account preferences",
  description: "Theme, contrast, text size, motion, your default view, and how you like to study.",
  robots: { index: false },
};

export default function SettingsPage() {
  return (
    <ContentPage
      title="Account preferences"
      intro="Theme, contrast, text size, motion, the view that opens first, and how you like to study. Changes apply right away."
    >
      <SettingsForm />
    </ContentPage>
  );
}
