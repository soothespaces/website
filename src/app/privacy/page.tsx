import type { Metadata } from "next";
import { ContentPage, PlaceholderNotice } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Privacy policy",
};

const POINTS = [
  {
    title: "Browsing needs no account",
    body: "Anyone can use the map and read check-in totals without signing in.",
  },
  {
    title: "Signing in",
    body: "You sign in with a @umich.edu Google account. We receive your name and email address from Google. We never see or store a password.",
  },
  {
    title: "Check-ins are anonymous",
    body: "A check-in records what a space is like (noise, light, busyness, how easy it is to focus) and when. Nobody else can see your individual check-ins. Other people only see totals, and times are rounded.",
  },
  {
    title: "Why we keep your account ID on a check-in",
    body: "Only to limit how often one account can check in to a space and to handle abuse. It is never shown to anyone.",
  },
  {
    title: "No questions about you",
    body: "Check-ins describe the space, not the person. We never ask about diagnoses or disabilities.",
  },
  {
    title: "Display settings",
    body: "If you're not signed in, settings such as theme and text size stay in your browser.",
  },
];

export default function PrivacyPage() {
  return (
    <ContentPage title="Privacy policy" intro="What we collect and who can see it.">
      <PlaceholderNotice>
        This summarizes how Soothe Spaces is designed to handle your data. It is
        not the final policy.
      </PlaceholderNotice>
      <div className="flex flex-col gap-6">
        {POINTS.map((point) => (
          <section key={point.title} className="flex flex-col gap-1">
            <h2 className="text-xl">{point.title}</h2>
            <p className="text-muted-foreground">{point.body}</p>
          </section>
        ))}
      </div>
    </ContentPage>
  );
}
