import type { Metadata } from "next";
import { ContentPage, PlaceholderNotice } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Terms of service",
};

const POINTS = [
  {
    title: "A student project",
    body: "Soothe Spaces is built by University of Michigan students. It is not run or endorsed by the University.",
  },
  {
    title: "Information can be out of date",
    body: "Conditions are reported by students and change quickly. Use them as a guide, and check with the building for anything you depend on, such as step-free access.",
  },
  {
    title: "Check in honestly",
    body: "Only check in to spaces you have actually been in. Don't submit check-ins to mislead other people.",
  },
  {
    title: "Accounts",
    body: "Checking in needs a @umich.edu account. We may limit or remove accounts that are used to abuse the service.",
  },
];

export default function TermsPage() {
  return (
    <ContentPage title="Terms of service" intro="The ground rules for using Soothe Spaces.">
      <PlaceholderNotice>
        These are draft terms written for the class project. They are not the
        final terms.
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
