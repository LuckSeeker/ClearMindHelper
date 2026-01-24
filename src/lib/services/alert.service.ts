import type { SupabaseClient } from "../../db/supabase.client";
import type { AlertDTO } from "../../types";
import { getCurrentBAC } from "./bac.service";
import { WIDMARK_CONSTANTS } from "../constants";
import { logInfo } from "../logger";

/**
 * Pobiera aktywne alerty dla imprezy, weryfikując własność imprezy.
 * Zwraca alerts lub error: 'not_found' | 'forbidden' | 'internal'.
 *
 * @param supabase SupabaseClient z kontekstu
 * @param userId   ID użytkownika (z tokena)
 * @param partyId  ID imprezy (bigint)
 */
export async function getActiveAlertsForParty(
  supabase: SupabaseClient,
  userId: string,
  partyId: number
): Promise<{ alerts?: AlertDTO[]; error?: "not_found" | "forbidden" | "internal" }> {
  // 1. Pobierz imprezę i sprawdź własność
  const { data: party, error: partyError } = await supabase
    .from("parties")
    .select("id, user_id")
    .eq("id", partyId)
    .single();

  if (partyError) {
    if (partyError.code === "PGRST116") return { error: "not_found" };
    return { error: "internal" };
  }
  if (!party) return { error: "not_found" };
  if (party.user_id !== userId) return { error: "forbidden" };

  // 2. Pobierz aktywne alerty
  const { data: alerts, error: alertsError } = await supabase
    .from("alerts")
    .select("*")
    .eq("party_id", partyId)
    .eq("user_id", userId)
    .eq("is_active", true);

  if (alertsError) return { error: "internal" };

  // 3. Mapuj do AlertDTO (konwersja typów na potrzeby DTO)
  const mapped: AlertDTO[] = (alerts || []).map((a) => ({
    id: a.id,
    alert_type: a.alert_type,
    is_active: a.is_active,
    bac_at_alert: a.bac_at_alert,
    triggered_at: a.triggered_at ? new Date(a.triggered_at).toISOString() : "",
    last_alert_sent_at: a.last_alert_sent_at ? new Date(a.last_alert_sent_at).toISOString() : "",
    party_id: a.party_id,
    user_id: a.user_id,
    created_at: a.created_at ?? "",
    updated_at: a.updated_at ?? "",
  }));

  return { alerts: mapped };
}

/**
 * Aktualizuje alerty po zmianie threshold BAC dla wszystkich otwartych imprez użytkownika.
 * Jeśli BAC >= threshold, tworzy/aktywuje alert exceeded_threshold.
 * Jeśli BAC < threshold, dezaktywuje alert exceeded_threshold, aktywuje approaching_threshold jeśli blisko progu.
 */
export async function updateAlertsAfterThresholdChange(supabase: SupabaseClient, userId: string): Promise<void> {
  // Pobierz aktualny threshold
  const { data: thresholdRow } = await supabase
    .from("userthresholds")
    .select("threshold_bac")
    .eq("user_id", userId)
    .eq("is_current", true)
    .maybeSingle();
  if (!thresholdRow) {
    // Brak threshold dla użytkownika – nie aktualizuję alertów
    logInfo(`Brak threshold BAC dla użytkownika ${userId} – alerty nie zostały zaktualizowane.`);
    return;
  }
  const threshold = thresholdRow.threshold_bac;

  // Pobierz jedyną otwartą imprezę użytkownika
  const { data: party } = await supabase
    .from("parties")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "ongoing")
    .single();
  if (!party) {
    logInfo(`Brak otwartej imprezy dla użytkownika ${userId} – alerty nie zostały zaktualizowane.`);
    return;
  }

  // Pobierz aktualny BAC dla imprezy
  let bac: number | null = null;
  try {
    const bacResult = await getCurrentBAC(supabase, party.id, userId);
    bac = bacResult.current_bac;
  } catch {
    logInfo(`Nie można pobrać BAC dla imprezy ${party.id} użytkownika ${userId} – alerty nie zostały zaktualizowane.`);
    return;
  }
  if (bac == null) {
    logInfo(`BAC jest null dla imprezy ${party.id} użytkownika ${userId} – alerty nie zostały zaktualizowane.`);
    return;
  }

  // Pobierz istniejący alert
  const { data: alerts } = await supabase
    .from("alerts")
    .select("id, alert_type")
    .eq("party_id", party.id)
    .eq("user_id", userId)
    .eq("is_active", true);

  // Dezaktywuj stare alerty
  if (alerts && alerts.length > 0) {
    for (const alert of alerts) {
      await supabase.from("alerts").update({ is_active: false }).eq("id", alert.id);
    }
  }

  // Utwórz nowy alert jeśli BAC >= threshold
  if (bac >= threshold) {
    await supabase.from("alerts").insert({
      party_id: party.id,
      user_id: userId,
      alert_type: "exceeded_threshold",
      is_active: true,
      bac_at_alert: bac,
      triggered_at: new Date().toISOString(),
      last_alert_sent_at: new Date().toISOString(),
    });
  } else if (bac >= WIDMARK_CONSTANTS.APPROACHING_THRESHOLD_RATIO * threshold) {
    // Jeśli BAC blisko progu, utwórz alert approaching_threshold
    await supabase.from("alerts").insert({
      party_id: party.id,
      user_id: userId,
      alert_type: "approaching_threshold",
      is_active: true,
      bac_at_alert: bac,
      triggered_at: new Date().toISOString(),
      last_alert_sent_at: new Date().toISOString(),
    });
  }
}
