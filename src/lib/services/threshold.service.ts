import type { ThresholdHistoryResponseDTO, UserThresholdDTO } from "../../types";
import type { SupabaseClient } from "../../db/supabase.client";
import type { ThresholdReason } from "../../types";
import { logEvent } from "./event.service";
import { logError } from "../../lib/logger";

/**
 * Pobiera historię progów użytkownika z paginacją, sortowane malejąco po created_at.
 */
export async function getThresholdHistory(
  userId: string,
  page: number,
  limit: number,
  supabase: SupabaseClient
): Promise<ThresholdHistoryResponseDTO> {
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const { data, error, count } = await supabase
    .from("userthresholds")
    .select("id, user_id, threshold_bac, is_current, reason, trigger_party_id, created_at", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  // Ensure created_at is always present; throw and log error if not
  const mappedData: UserThresholdDTO[] = (data ?? []).map((item) => {
    if (!item.created_at) {
      logError(`Missing created_at for userthresholds.id=${item.id} (user_id=${item.user_id}) in getThresholdHistory`);
      throw new Error(`Database integrity error: missing created_at for userthresholds.id=${item.id}`);
    }
    return {
      ...item,
      created_at: item.created_at,
    };
  });

  return {
    data: mappedData,
    pagination: {
      page,
      limit,
      total_count: count ?? 0,
      total_pages: count ? Math.ceil(count / limit) : 1,
    },
  };
}

/**
 * Pobiera aktualny próg użytkownika (is_current = true).
 * Zwraca null jeśli nie istnieje.
 */
export async function getCurrentThreshold(userId: string, supabase: SupabaseClient): Promise<UserThresholdDTO | null> {
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
  if (!data) {
    logError(`No current threshold found for user_id=${userId} in getCurrentThreshold`);
    throw new Error(`Database integrity error: no current threshold for user_id=${userId}`);
  }
  if (!data.created_at) {
    logError(`Missing created_at for userthresholds.id=${data.id} (user_id=${data.user_id}) in getCurrentThreshold`);
    throw new Error(`Database integrity error: missing created_at for userthresholds.id=${data.id}`);
  }
  return {
    ...data,
    created_at: data.created_at,
  };
}

/**
 * Tworzy domyślny próg dla użytkownika (1.0‰, reason: "default").
 * Loguje event threshold_adjusted (nie przerywa flow przy błędzie logowania).
 */
export async function createDefaultThreshold(userId: string, supabase: SupabaseClient): Promise<UserThresholdDTO> {
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

  if (!data) throw new Error("Failed to create default threshold");
  if (!data.created_at) {
    logError(`Missing created_at for userthresholds.id=${data.id} (user_id=${data.user_id}) in createDefaultThreshold`);
    throw new Error(`Database integrity error: missing created_at for userthresholds.id=${data.id}`);
  }
  return {
    ...data,
    created_at: data.created_at,
  };
}
