import type { Json } from "@/types/supabase";
import { createClient } from "@/lib/supabase/client";
import { settingsDocument, type Settings } from "./model";

export function isEmptySettings(value: unknown): boolean {
  return (
    value == null ||
    (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0)
  );
}

export async function loadAccountSettings(userId: string): Promise<unknown | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_settings")
    .select("settings")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.settings ?? null;
}

export async function saveAccountSettings(
  userId: string,
  settings: Settings,
  extras: Record<string, unknown>,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("user_settings").upsert({
    user_id: userId,
    settings: settingsDocument(settings, extras) as { [key: string]: Json | undefined },
  });
  if (error) throw error;
}
