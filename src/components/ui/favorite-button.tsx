"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HeartFilledIcon, HeartIcon } from "@/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { loginHref, loginHrefFor } from "@/lib/auth/paths";

export function FavoriteButton({
  name,
  pressed,
  onPressedChange,
  signedIn,
}: {
  name: string;
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  signedIn: boolean;
}) {
  const pathname = usePathname();
  const [bounce, setBounce] = useState(false);
  const label = pressed ? `Remove ${name} from your spots` : `Add ${name} to your spots`;
  const heart = pressed ? (
    <HeartFilledIcon className={bounce ? "animate-heart-in text-destructive" : "text-destructive"} onAnimationEnd={() => setBounce(false)} />
  ) : (
    <HeartIcon />
  );

  if (!signedIn) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" shape="circle" aria-label={`Add ${name} to your spots`} aria-pressed={false}>
            <HeartIcon />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end">
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm">Sign in to save your spots</p>
            <Button asChild size="sm">
              <Link
                href={loginHref(pathname)}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                  event.preventDefault();
                  window.location.assign(loginHrefFor(window.location.pathname, window.location.search));
                }}
              >
                Sign in
              </Link>
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      shape="circle"
      aria-label={label}
      aria-pressed={pressed}
      onClick={() => {
        const next = !pressed;
        onPressedChange(next);
        setBounce(next);
      }}
    >
      {heart}
    </Button>
  );
}
