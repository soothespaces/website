import type { Metadata } from "next";
import { ContentPage, PlaceholderNotice } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Sign up or sign in",
  robots: { index: false },
};

export default function SignInPage() {
  return (
    <ContentPage
      title="Sign up or sign in"
      intro="Use your @umich.edu Google account. There's no password, and the same button works whether or not you've been here before."
    >
      <PlaceholderNotice>
        Google sign-in isn&apos;t connected yet. You can still browse the map
        and read check-ins without an account.
      </PlaceholderNotice>
    </ContentPage>
  );
}
