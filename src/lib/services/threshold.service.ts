import type { SupabaseClient } from "../../db/supabase.client";
import type { UserThreshold, ThresholdReason } from "../../types";
import { logEvent } from "./event.service";

/**
 * Pobiera aktualny próg użytkownika (is_current = true).
 * Zwraca null jeśli nie istnieje.
 */
export async function getCurrentThreshold(userId: string, supabase: SupabaseClient): Promise<UserThreshold | null> {
  const { data, error } = await supabase
    .from("userthresholds")
    .select("*")
    .eq("user_id", userId)
    .eq("is_current", true)
    .single();

  if (error) {
    // Jeśli nie znaleziono (PGRST116), zwróć null
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data;
}

/**
 * Tworzy domyślny próg dla użytkownika (1.0‰, reason: "default").
 * Loguje event threshold_adjusted (nie przerywa flow przy błędzie logowania).
 */
export async function createDefaultThreshold(userId: string, supabase: SupabaseClient): Promise<UserThreshold> {
  const DEFAULT_THRESHOLD_BAC = 1.0;
  const insertData = {
    user_id: userId,
    threshold_bac: DEFAULT_THRESHOLD_BAC,
    is_current: true,
    reason: "default" as ThresholdReason,
    trigger_party_id: null,
  };

  const { data, error } = await supabase.from("userthresholds").insert(insertData).select().single();

  if (error) throw error;

  await logEvent(supabase, userId, "threshold_adjusted");

  return data;
}
