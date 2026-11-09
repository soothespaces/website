import { ContentPage } from "@/components/content-page";
import { Button } from "@/components/ui/button";

/** What a signed-in visitor who isn't on the admin list sees instead of /admin. */
export function NotAdmin() {
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
