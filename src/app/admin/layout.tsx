import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canAdminFloors } from "@/features/floor-alignment/access";
import { loginHref } from "@/lib/auth/paths";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · Soothe Spaces" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  if (!(await canAdminFloors())) redirect(loginHref("/admin/floors"));
  return children;
}
