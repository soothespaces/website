import type { Metadata } from "next";
import { NotAdmin } from "@/components/auth/not-admin";

export const metadata: Metadata = {
  title: "Admins only",
  robots: { index: false, follow: false },
};

// src/proxy.ts rewrites /admin page loads here for signed-in visitors who
// aren't admins, so none of the admin pages' loaders run for them.
export default function AdminsOnlyPage() {
  return <NotAdmin />;
}
