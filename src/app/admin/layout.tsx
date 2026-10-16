import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ContentPage } from "@/components/content-page";
import { getAdminAccess } from "@/lib/auth/admin";
import { loginHref } from "@/lib/auth/paths";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · Soothe Spaces" },
  robots: { index: false, follow: false },
};

// Every page under /admin is for team admins only (private.admins in
// Supabase). src/proxy.ts checks first; this is the check next to the data.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const access = await getAdminAccess();
  if (access === "signed-out") redirect(loginHref("/admin"));
  if (access === "not-admin") return <NotAdmin />;
  return children;
}

function NotAdmin() {
  return (
    <ContentPage
      title="Admins only"
      intro="This part of Soothe Spaces is for the team. You're signed in with an account that isn't on the admin list."
    >
      <form action="/auth/signout" method="post">
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </ContentPage>
  );
}
