"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { DetailScreen } from "@/components/ui/detail-screen";
import { Skeleton } from "@/components/ui/feedback";
import { CloseIcon } from "@/components/ui/icons";
import { loginHref } from "@/lib/auth/paths";
import { useSession } from "@/lib/auth/use-session";
import { useMyCheckInHistory } from "@/lib/data/my-history";
import { useMapState } from "@/features/map/map-state";
import type { PanelScreenProps } from "@/features/side-view/builtin-screens";
import { panelHref, type PanelRoute } from "@/features/side-view/panel-route";
import { MonthCard } from "./month-card";
import { Rotation } from "./rotation";
import { useNow } from "./use-now";
import { Visited } from "./visited";

const TITLES: Record<PanelRoute["kind"], string> = {
  home: "Home",
  building: "Building",
  hours: "Hours",
  spaces: "Spaces",
  rooms: "Rooms",
  "rooms-map": "Rooms map",
  photos: "Photos",
  space: "Space",
  preferences: "Preferences",
  "my-spots": "Your spots",
};

// J1. The Your spots screen. J2 to J5 fill the sections below the title.
export function MySpotsScreen({ route }: PanelScreenProps) {
  const { stack, back, clear, data } = useMapState();
  const { user, loading } = useSession();
  if (route.kind !== "my-spots") return null;

  return (
    <DetailScreen
      title="Your spots"
      backTo={previousTitle(stack, data)}
      onBack={back}
      className="min-h-0 flex-1"
      actions={
        <Button variant="ghost" size="icon" shape="circle" onClick={clear} aria-label="Close" className="text-muted-foreground">
          <CloseIcon />
        </Button>
      }
    >
      {loading ? <Loading /> : user ? <SignedIn /> : <SignedOut />}
    </DetailScreen>
  );
}

function previousTitle(stack: PanelRoute[], data: ReturnType<typeof useMapState>["data"]): string {
  const previous = stack.at(-2);
  if (!previous || previous.kind === "home") return "Home";
  if (previous.kind === "building") {
    return previous.name || (previous.slug ? data.buildingsBySlug.get(previous.slug)?.name : undefined) || "Building";
  }
  if (previous.kind === "space") {
    return data.spaces.find((space) => space.slug === previous.id)?.name || "Space";
  }
  return TITLES[previous.kind];
}

function Loading() {
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">Loading your spots</span>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

function SignedOut() {
  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-sm text-muted-foreground">
        Sign in to see the places you keep coming back to, and a private summary of your check-ins. Only you can see it.
      </p>
      <Suspense
        fallback={
          <Button asChild>
            <Link href={loginHref("/map?panel=my-spots")}>Sign in</Link>
          </Button>
        }
      >
        <SignInLink />
      </Suspense>
    </div>
  );
}

function SignInLink() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const next = panelHref(pathname, { kind: "my-spots" }, new URLSearchParams(searchParams.toString()));
  return (
    <Button asChild>
      <Link href={loginHref(next)}>Sign in</Link>
    </Button>
  );
}

function SignedIn() {
  const now = useNow();
  const history = useMyCheckInHistory();
  return (
    <div className="flex flex-col gap-6">
      <MonthCard now={now} history={history} />
      <Rotation now={now} />
      <Visited now={now} history={history} />
    </div>
  );
}
