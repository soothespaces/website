import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NotAdmin } from "@/components/auth/not-admin";
import { getAdminAccess } from "@/lib/auth/admin";
import { loginHref } from "@/lib/auth/paths";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · Soothe Spaces" },
  robots: { index: false, follow: false },
};

// Every page under /admin is for team admins only (private.admins in
// Supabase). src/proxy.ts checks first and sends non-admins to /admins-only;
// this is the check next to the data.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const access = await getAdminAccess();
  if (access === "signed-out") redirect(loginHref("/admin"));
  if (access === "not-admin") return <NotAdmin />;
  return children;
}
