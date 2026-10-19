"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HeartFilledIcon, HeartIcon } from "@/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { loginHref } from "@/lib/auth/paths";

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
              <Link href={loginHref()}>Sign in</Link>
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
