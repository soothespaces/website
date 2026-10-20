"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { useFavorites } from "@/lib/data/favorites";
import { parseHistory } from "@/lib/data/my-history";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { onCheckedIn, type CheckedInEvent } from "./checked-in";

const THANKS = "Thanks. Your check-in helps others find a spot.";

async function offerAdd(event: CheckedInEvent): Promise<boolean> {
  if (event.targetKind !== "space" || !getSupabaseEnv()) return false;
  try {
    const supabase = createClient();
    const [history, favorite] = await Promise.all([
      supabase.rpc("my_check_in_history"),
      supabase.from("favorites").select("id").eq("space_id", event.targetId).limit(1),
    ]);
    if (history.error || favorite.error) return false;
    const place = parseHistory(history.data).find((row) => row.targetKind === "space" && row.targetId === event.targetId);
    if (!place || place.checkInCount !== 3) return false;
    return (favorite.data?.length ?? 0) === 0;
  } catch (error) {
    console.error("Check-in follow-up failed", error);
    return false;
  }
}

// Closes nothing itself: the sheet already closed. This is the thanks toast,
// plus "Add to your spots" on the third check-in at a place that isn't saved.
export function CheckedInToast() {
  const toast = useToast();
  const { add } = useFavorites();

  useEffect(() => {
    return onCheckedIn((event) => {
      void (async () => {
        const third = await offerAdd(event);
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
  }, [add, toast]);

  return null;
}
