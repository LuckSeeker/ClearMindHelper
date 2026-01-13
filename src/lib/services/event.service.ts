/**
 * Event Service
 *
 * Centralized service for logging events to the database.
 * Events track important user actions for analytics and audit trail.
 */

import type { SupabaseClient } from "../../db/supabase.client";
import type { EventType } from "../../types";
import { logError, logInfo } from "../logger";

/**
 * Logs an event to the events table
 *
 * This is a non-critical operation - failures are logged but don't throw errors
 * to avoid disrupting the main application flow.
 *
 * @param supabase - Supabase client instance
 * @param userId - The authenticated user's UUID
 * @param eventType - Type of event to log
 * @param partyId - Optional party ID if event is related to a party
 * @returns Promise that resolves when event is logged (or fails silently)
 */
export async function logEvent(
  supabase: SupabaseClient,
  userId: string,
  eventType: EventType,
  partyId?: number
): Promise<void> {
  const { error } = await supabase.from("events").insert({
    user_id: userId,
    event_type: eventType,
    party_id: partyId ?? null,
  });

  if (error) {
    logError("Failed to log event", { userId, eventType, partyId, error: error.message });
    // Don't throw - event logging is non-critical
    return;
  }

  logInfo("Event logged", { userId, eventType, partyId });
}
