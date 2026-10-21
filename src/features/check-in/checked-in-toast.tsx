"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { useFavorites } from "@/lib/data/favorites";
import { parseHistory } from "@/lib/data/my-history";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { onCheckedIn, type CheckedInEvent } from "@/lib/data/check-in-events";

const THANKS = "Thanks. Your check-in helps others find a spot.";

async function offerAdd(
  event: CheckedInEvent,
  favorite: boolean,
  favoritesReady: boolean,
): Promise<boolean> {
  if (event.targetKind !== "space" || !favoritesReady || favorite || !getSupabaseEnv()) return false;
  try {
    const supabase = createClient();
    const history = await supabase.rpc("my_check_in_history");
    if (history.error) return false;
    const place = parseHistory(history.data).find((row) => row.targetKind === "space" && row.targetId === event.targetId);
    return place?.checkInCount === 3;
  } catch (error) {
    console.error("Check-in follow-up failed", error);
    return false;
  }
}

// Closes nothing itself: the sheet already closed. This is the thanks toast,
// plus "Add to your spots" on the third check-in at a place that isn't saved.
export function CheckedInToast() {
  const toast = useToast();
  const { add, isFavorite, loaded, signedIn } = useFavorites();

  useEffect(() => {
    return onCheckedIn((event) => {
      const alreadySaved = event.targetKind === "space" && isFavorite({ kind: "space", spaceId: event.targetId });
      void (async () => {
        const third = await offerAdd(event, alreadySaved, loaded && signedIn);
        toast({
          title: THANKS,
          announce: "status",
          duration: third ? 8000 : 5000,
          action:
            third && event.targetKind === "space"
              ? {
                  label: "Add to your spots",
                  onClick: () => {
                    void add({ kind: "space", spaceId: event.targetId });
                  },
                }
              : undefined,
        });
      })();
    });
  }, [add, isFavorite, loaded, signedIn, toast]);

  return null;
}
