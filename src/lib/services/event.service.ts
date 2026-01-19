import type { SupabaseClient } from "../../db/supabase.client";
import type { LogEventCommandInput } from "../validation/event.validation";
import type { EventDTO } from "../../types";
import { ERROR_CODES } from "../constants";

export class EventService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Log telemetry event for user
   * @param userId - authenticated user id
   * @param command - validated event command
   * @returns EventDTO or throws APIError
   */
  async logEvent(userId: string, command: LogEventCommandInput): Promise<EventDTO> {
    // Validate event_type (already done by Zod)
    // If party_id provided, check if party exists and belongs to user
    let partyId: number | null = null;
    if (command.party_id !== undefined && command.party_id !== null) {
      // party_id może być bigint, string lub number, ale w bazie to number
      partyId = typeof command.party_id === "bigint" ? Number(command.party_id) : Number(command.party_id);
      const { data: party, error } = await this.supabase
        .from("parties")
        .select("id, user_id")
        .eq("id", partyId)
        .maybeSingle();
      if (error) {
        if (error.code === "PGRST116") throw new Error(ERROR_CODES.PARTY_NOT_FOUND);
        throw new Error(ERROR_CODES.DATABASE_ERROR);
      }
      if (!party || party.user_id !== userId) {
        throw new Error(ERROR_CODES.PARTY_NOT_FOUND);
      }
    }
    // Insert event
    const { data, error } = await this.supabase
      .from("events")
      .insert({
        user_id: userId,
        party_id: partyId,
        event_type: command.event_type,
      })
      .select("id, event_type, created_at")
      .single();
    if (error || !data) {
      throw new Error(ERROR_CODES.FAILED_TO_LOG_EVENT);
    }
    return data as EventDTO;
  }
}
