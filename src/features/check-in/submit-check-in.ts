"use client";

import { createClient } from "@/lib/supabase/client";
import type { BusynessLevel, LightLevel, NoiseLevel } from "@/lib/data/check-ins";

export type CheckInAnswers = {
  targetKind: "space" | "room";
  targetId: string;
  noise?: NoiseLevel | null;
  light?: LightLevel | null;
  naturalLight?: boolean | null;
  busyness?: BusynessLevel | null;
};

export type CheckInResult = { ok: true } | { ok: false; message: string };

type CheckInError = { code?: string | null; message?: string | null; status?: number | null } | null | undefined;

// The rate limit is SQLSTATE PT429 ("You checked in here in the last hour").
// A missing or non-umich session is 42501.
export function checkInErrorMessage(error: CheckInError): string {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  if (code === "PT429" || error?.status === 429 || /last hour/i.test(message)) {
    return "You checked in here recently.";
  }
  if (code === "42501" || /sign in/i.test(message)) {
    return "Sign in with your @umich.edu account to check in.";
  }
  return "Couldn't check in. Try again in a moment.";
}

export async function submitCheckIn(answers: CheckInAnswers): Promise<CheckInResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.rpc("submit_check_in", {
      target_kind: answers.targetKind,
      target_id: answers.targetId,
      ...(answers.noise ? { noise: answers.noise } : {}),
      ...(answers.light ? { light: answers.light } : {}),
      ...(answers.naturalLight != null ? { natural_light: answers.naturalLight } : {}),
      ...(answers.busyness ? { busyness: answers.busyness } : {}),
    });
    if (error) return { ok: false, message: checkInErrorMessage(error) };
    return { ok: true };
  } catch (error) {
    console.error("Check-in failed", error);
    const message = error instanceof Error ? error.message : "";
    return { ok: false, message: checkInErrorMessage({ message }) };
  }
}
