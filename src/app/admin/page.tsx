import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Admin",
};

// Each admin tool, linked from /admin. Add a row when a new tool lands.
const SECTIONS = [
  {
    href: "/admin/floors",
    title: "Floor plans",
    description: "Check how each MPrint sheet sits on its building and fix its alignment.",
  },
];

export default function AdminPage() {
  return (
    <ContentPage title="Admin" intro="Tools for the Soothe Spaces team.">
      <ul className="flex flex-col divide-y divide-border rounded-md border border-input">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="flex flex-col gap-1 px-4 py-3 hover:bg-accent">
              <span className="font-medium">{s.title}</span>
              <span className="text-sm text-muted-foreground">{s.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </ContentPage>
  );
}
