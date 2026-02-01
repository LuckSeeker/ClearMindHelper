/**
 * Party Service
 *
 * Handles business logic for party operations including:
 * - Starting new party sessions
 * - Checking for ongoing parties
 * - Creating profile snapshots
 * - Logging party events
 * - Managing party lifecycle
 */

import type { SupabaseClient } from "../../db/supabase.client";
import { parseProfileSnapshot } from "../type-guards";
import type { Database } from "../../db/database.types";
import type {
  PartyDTO,
  ProfileSnapshot,
  Party,
  PartyListResponseDTO,
  PartyListItemDTO,
  DrinkPreview,
  PartyStatus,
  PartyDetailDTO,
  DrinkWithBACDTO,
  BACCalculationDTO,
  AlertDTO,
  ClosePartyCommand,
  ClosePartyResponseDTO,
  MarkBlackoutResponseDTO,
} from "../../types";
import { getUserProfile, isProfileComplete, getMissingFields } from "./profile.service";
import { logError, logInfo } from "../logger";
import { verifyPartyOwnershipOrThrow } from "../api-helpers";
import { EventService } from "./event.service";
import { ERROR_CODES, BLACKOUT_MIN_THRESHOLD_BAC } from "../constants";

/**
 * Checks if user has an ongoing party
 *
 * A party is considered ongoing when its status is 'ongoing'.
 * Users can only have one ongoing party at a time.
 *
 * @param supabase - Supabase client instance
 * @param userId - The authenticated user's UUID
 * @returns True if user has an ongoing party
 * @throws Error if database query fails
 */
export async function hasOngoingParty(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("parties")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "ongoing")
    .maybeSingle();

  if (error) {
    logError("Failed to check for ongoing party", { userId, error: error.message });
    throw new Error(`Database error: ${error.message}`);
  }

  return data !== null;
}

/**
 * Gets user's ongoing party if it exists
 *
 * @param supabase - Supabase client instance
 * @param userId - The authenticated user's UUID
 * @returns Ongoing party or null if none exists
 * @throws Error if database query fails
 */
export async function getOngoingParty(supabase: SupabaseClient, userId: string): Promise<Party | null> {
  const { data, error } = await supabase
    .from("parties")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "ongoing")
    .maybeSingle();

  if (error) {
    logError("Failed to get ongoing party", { userId, error: error.message });
    throw new Error(`Database error: ${error.message}`);
  }

  return data;
}

/**
 * Creates an immutable snapshot of user profile
 *
 * Profile snapshot captures user's physical parameters at the moment
 * of party start. This ensures BAC calculations remain accurate even
 * if user updates their profile during the party.
 *
 * @param profile - User profile with required fields (height, weight, gender)
 * @returns ProfileSnapshot with captured_at timestamp
 */
export function createProfileSnapshot(profile: {
  height_cm: number;
  weight_kg: number;
  gender: string;
}): ProfileSnapshot {
  return {
    height_cm: profile.height_cm,
    weight_kg: profile.weight_kg,
    gender: profile.gender as "M" | "F",
    captured_at: new Date().toISOString(),
  };
}

/**
 * Starts a new party session for authenticated user
 *
 * This is the main business logic for POST /api/parties endpoint.
 * It performs the following steps:
 * 1. Validates user profile completeness
 * 2. Checks for existing ongoing party (conflict prevention)
 * 3. Creates immutable profile snapshot
 * 4. Inserts new party record with status 'ongoing'
 * 5. Logs 'party_started' event
 *
 * @param supabase - Supabase client instance
 * @param userId - The authenticated user's UUID
 * @param startedAt - Optional start timestamp (ISO 8601), defaults to current time
 * @returns PartyDTO with created party data
 * @throws Error with specific message for different failure scenarios
 */
export async function startParty(supabase: SupabaseClient, userId: string, startedAt?: string): Promise<PartyDTO> {
  logInfo("Starting party", { userId, startedAt });

  // Step 1: Get and validate user profile
  const profile = await getUserProfile(userId, supabase);

  if (!profile) {
    logInfo("User attempted to start party without profile", { userId });
    throw new Error(ERROR_CODES.PROFILE_NOT_FOUND);
  }

  if (!isProfileComplete(profile)) {
    const missing = getMissingFields(profile);
    logInfo("User attempted to start party with incomplete profile", {
      userId,
      missingFields: missing,
    });
    throw new Error(`PROFILE_INCOMPLETE:${missing.join(",")}`);
  }

  // Step 2: Check for ongoing party
  const hasOngoing = await hasOngoingParty(supabase, userId);

  if (hasOngoing) {
    logInfo("User attempted to start party while one is already ongoing", { userId });
    throw new Error(ERROR_CODES.PARTY_ALREADY_ONGOING);
  }

  // Step 3: Create profile snapshot
  // At this point, we know profile is complete (checked above)
  const profileSnapshot = createProfileSnapshot({
    height_cm: profile.height_cm as number,
    weight_kg: profile.weight_kg as number,
    gender: profile.gender as string,
  });

  // Step 4: Insert new party
  const { data: newParty, error: insertError } = await supabase
    .from("parties")
    .insert({
      user_id: userId,
      status: "ongoing" as const,
      started_at: startedAt || new Date().toISOString(),
      ended_at: null,
      bac_estimate_max: 0,
      total_drinks_count: 0,
      total_ml_consumed: 0,
      blackout_marked: false,
      blackout_marked_at: null,
      profile_snapshot: JSON.parse(JSON.stringify(profileSnapshot)),
    })
    .select()
    .single();

  if (insertError) {
    logError("Failed to insert party", { userId, error: insertError.message });
    throw new Error(`Database error: ${insertError.message}`);
  }

  if (!newParty) {
    logError("Insert returned no data", { userId });
    throw new Error("Failed to create party: no data returned");
  }

  logInfo("Party created successfully", { userId, partyId: newParty.id });

  // Step 5: Log party_started event (non-critical)
  await new EventService(supabase).logEvent(userId, {
    event_type: "party_started",
    party_id: BigInt(newParty.id),
  });

  // Transform to DTO - Base PartyDTO
  const partyDTO: PartyDTO = {
    id: newParty.id,
    user_id: newParty.user_id,
    status: newParty.status,
    started_at: new Date(newParty.started_at).toISOString(),
    ended_at: newParty.ended_at ? new Date(newParty.ended_at).toISOString() : null,
    bac_estimate_max: newParty.bac_estimate_max,
    total_drinks_count: newParty.total_drinks_count,
    total_ml_consumed: newParty.total_ml_consumed,
    blackout_marked: newParty.blackout_marked,
    blackout_marked_at: newParty.blackout_marked_at ? new Date(newParty.blackout_marked_at).toISOString() : null,
    profile_snapshot: parseProfileSnapshot(newParty.profile_snapshot),
    created_at: newParty.created_at ? new Date(newParty.created_at).toISOString() : new Date().toISOString(),
    updated_at: newParty.updated_at ? new Date(newParty.updated_at).toISOString() : new Date().toISOString(),
  };

  return partyDTO;
}

/**
 * Gets paginated list of user's parties with drink previews
 *
 * This is the main business logic for GET /api/parties endpoint.
 * It performs the following steps:
 * 1. Builds base query with filters (status)
 * 2. Applies sorting and pagination
 * 3. Gets total count for pagination metadata
 * 4. Fetches first 3 drinks for each party
 * 5. Assembles response with pagination data
 *
 * @param supabase - Supabase client instance
 * @param userId - The authenticated user's UUID
 * @param filters - Optional filters (status)
 * @param pagination - Pagination and sorting parameters
 * @returns PartyListResponseDTO with paginated parties and metadata
 * @throws Error if database query fails
 */
export async function getPartyList(
  supabase: SupabaseClient,
  userId: string,
  filters: {
    status?: PartyStatus;
  },
  pagination: {
    page: number;
    limit: number;
    sort: "started_at" | "bac_estimate_max";
    order: "asc" | "desc";
  }
): Promise<PartyListResponseDTO> {
  logInfo("Getting party list", { userId, filters, pagination });

  // Step 1: Build base query with user filter
  let countQuery = supabase.from("parties").select("*", { count: "exact", head: true }).eq("user_id", userId);

  // Apply status filter if provided
  if (filters.status) {
    countQuery = countQuery.eq("status", filters.status);
  }

  // Get total count first
  const { count, error: countError } = await countQuery;

  if (countError) {
    logError("Failed to count parties", { userId, error: countError.message });
    throw new Error(`Database error: ${countError.message}`);
  }

  const totalCount = count ?? 0;
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pagination.limit) : 0;

  // If page is out of range, return empty result immediately
  if (pagination.page > totalPages && totalPages > 0) {
    logInfo("Page out of range", { userId, page: pagination.page, totalPages });
    return {
      data: [],
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total_count: totalCount,
        total_pages: totalPages,
      },
    };
  }

  // If no results at all, return empty
  if (totalCount === 0) {
    logInfo("No parties found", { userId, filters });
    return {
      data: [],
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total_count: 0,
        total_pages: 0,
      },
    };
  }

  // Step 2: Build data query
  let query = supabase.from("parties").select("*").eq("user_id", userId);

  // Apply status filter
  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  // Apply sorting
  query = query.order(pagination.sort, { ascending: pagination.order === "asc" });

  // Apply pagination
  const from = (pagination.page - 1) * pagination.limit;
  const to = from + pagination.limit - 1;
  query = query.range(from, to);

  // Execute query
  const { data: parties, error } = await query;

  if (error) {
    logError("Failed to fetch parties", { userId, error: error.message });
    throw new Error(`Database error: ${error.message}`);
  }

  // Handle empty result (shouldn't happen after count check, but defensive)
  if (!parties || parties.length === 0) {
    logInfo("No parties in page", { userId, page: pagination.page });
    return {
      data: [],
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total_count: totalCount,
        total_pages: totalPages,
      },
    };
  }

  // Step 4: Fetch first 3 drinks for each party
  const partyIds = parties.map((p) => p.id);
  const { data: allDrinks, error: drinksError } = await supabase
    .from("drinks")
    .select("id, party_id, volume_ml, abv_percent, consumed_at")
    .in("party_id", partyIds)
    .order("consumed_at", { ascending: true });

  if (drinksError) {
    logError("Failed to fetch drinks preview", { userId, error: drinksError.message });
    throw new Error(`Database error: ${drinksError.message}`);
  }

  // Group drinks by party_id and take first 3
  const drinksByParty = new Map<number, DrinkPreview[]>();
  if (allDrinks) {
    for (const drink of allDrinks) {
      let partyDrinks = drinksByParty.get(drink.party_id);
      if (!partyDrinks) {
        partyDrinks = [];
        drinksByParty.set(drink.party_id, partyDrinks);
      }
      if (partyDrinks.length < 3) {
        partyDrinks.push({
          id: drink.id,
          volume_ml: drink.volume_ml,
          abv_percent: drink.abv_percent,
          consumed_at: new Date(drink.consumed_at).toISOString(),
        });
      }
    }
  }

  // Step 5: Transform to DTOs
  const partyListItems: PartyListItemDTO[] = parties.map((party) => ({
    id: party.id,
    user_id: party.user_id,
    status: party.status,
    started_at: new Date(party.started_at).toISOString(),
    ended_at: party.ended_at ? new Date(party.ended_at).toISOString() : null,
    bac_estimate_max: party.bac_estimate_max,
    total_drinks_count: party.total_drinks_count,
    total_ml_consumed: party.total_ml_consumed,
    blackout_marked: party.blackout_marked,
    blackout_marked_at: party.blackout_marked_at ? new Date(party.blackout_marked_at).toISOString() : null,
    profile_snapshot: parseProfileSnapshot(party.profile_snapshot),
    created_at: party.created_at ? new Date(party.created_at).toISOString() : new Date().toISOString(),
    updated_at: party.updated_at ? new Date(party.updated_at).toISOString() : new Date().toISOString(),
    drinks_preview: drinksByParty.get(party.id) || [],
  }));

  logInfo("Party list retrieved successfully", {
    userId,
    count: partyListItems.length,
    totalCount,
    totalPages,
  });

  return {
    data: partyListItems,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total_count: totalCount,
      total_pages: totalPages,
    },
  };
}

/**
 * Gets detailed information about a specific party
 *
 * This is the main business logic for GET /api/parties/:id endpoint.
 * It performs the following steps:
 * 1. Fetches party by ID and user ID
 * 2. Verifies party ownership (authorization)
 * 3. Fetches all drinks with BAC calculations
 * 4. Fetches active alerts
 * 5. Determines current BAC if party is ongoing
 * 6. Assembles complete PartyDetailDTO
 *
 * @param supabase - Supabase client instance
 * @param userId - The authenticated user's UUID
 * @param partyId - The party ID to fetch
 * @returns PartyDetailDTO with complete party information
 * @throws Error with specific message for different failure scenarios:
 *   - "PARTY_NOT_FOUND" if party doesn't exist or user doesn't have access
 *   - Database errors for query failures
 */
export async function getPartyDetails(
  supabase: SupabaseClient,
  userId: string,
  partyId: number
): Promise<PartyDetailDTO> {
  logInfo("Getting party details", { userId, partyId });

  // Step 1: Verify party exists and belongs to user
  const party = (await verifyPartyOwnershipOrThrow(supabase, partyId, userId)) as Party;

  // Step 3: Fetch all drinks with BAC calculations (using LEFT JOIN)
  const { data: drinksData, error: drinksError } = await supabase
    .from("drinks")
    .select(
      `
      *,
      baccalculations (
        id,
        drink_id,
        party_id,
        user_id,
        calculated_bac,
        time_since_first_drink_minutes,
        algorithm_version,
        metabolized_alcohol_g,
        user_profile_snapshot,
        calculation_timestamp,
        created_at
      )
    `
    )
    .eq("party_id", partyId)
    .order("consumed_at", { ascending: true });

  if (drinksError) {
    logError("Failed to fetch drinks with BAC", {
      userId,
      partyId,
      error: drinksError.message,
    });
    throw new Error(`Database error: ${drinksError.message}`);
  }

  // Step 4: Fetch all alerts (not only active)
  const { data: allAlertsData, error: allAlertsError } = await supabase
    .from("alerts")
    .select("*")
    .eq("party_id", partyId)
    .order("triggered_at", { ascending: false });

  if (allAlertsError) {
    logError("Failed to fetch all alerts", {
      userId,
      partyId,
      error: allAlertsError.message,
    });
    throw new Error(`Database error: ${allAlertsError.message}`);
  }

  // Step 5: Transform drinks to DTOs
  const drinks: DrinkWithBACDTO[] =
    drinksData?.map((drink) => {
      // Extract BAC calculation if exists (Supabase returns array for joined relations)
      type BACCalculationRow = Database["public"]["Tables"]["baccalculations"]["Row"];
      const bacArray = drink.baccalculations as BACCalculationRow[] | null;
      const bacData = bacArray && bacArray.length > 0 ? bacArray[0] : null;

      const drinkDTO: DrinkWithBACDTO = {
        id: drink.id,
        party_id: drink.party_id,
        user_id: drink.user_id,
        volume_ml: drink.volume_ml,
        abv_percent: drink.abv_percent,
        consumed_at: new Date(drink.consumed_at).toISOString(),
        order_sequence: drink.order_sequence,
        edit_count: drink.edit_count,
        edited_at: drink.edited_at ? new Date(drink.edited_at).toISOString() : null,
        original_values: drink.original_values,
        created_at: drink.created_at ? new Date(drink.created_at).toISOString() : new Date().toISOString(),
        updated_at: drink.updated_at ? new Date(drink.updated_at).toISOString() : new Date().toISOString(),
        bac_calculation: bacData
          ? {
              id: bacData.id,
              drink_id: bacData.drink_id,
              party_id: bacData.party_id,
              user_id: bacData.user_id,
              calculated_bac: bacData.calculated_bac,
              time_since_first_drink_minutes: bacData.time_since_first_drink_minutes,
              algorithm_version: bacData.algorithm_version,
              metabolized_alcohol_g: bacData.metabolized_alcohol_g,
              user_profile_snapshot: parseProfileSnapshot(bacData.user_profile_snapshot),
              calculation_timestamp: new Date(bacData.calculation_timestamp || new Date()).toISOString(),
              created_at: bacData.created_at ? new Date(bacData.created_at).toISOString() : new Date().toISOString(),
            }
          : null,
      };

      return drinkDTO;
    }) || [];

  // Step 6: Transform all alerts to DTOs
  const allAlerts: AlertDTO[] =
    allAlertsData?.map((alert) => ({
      id: alert.id,
      user_id: alert.user_id,
      party_id: alert.party_id,
      alert_type: alert.alert_type,
      bac_at_alert: alert.bac_at_alert,
      last_alert_sent_at: alert.last_alert_sent_at ? new Date(alert.last_alert_sent_at).toISOString() : null,
      triggered_at: new Date(alert.triggered_at).toISOString(),
      is_active: alert.is_active,
      created_at: alert.created_at ? new Date(alert.created_at).toISOString() : new Date().toISOString(),
      updated_at: alert.updated_at ? new Date(alert.updated_at).toISOString() : new Date().toISOString(),
    })) || [];

  // Step 7: Determine current BAC (last drink's BAC calculation for ongoing parties)
  let currentBAC: BACCalculationDTO | null = null;
  if (party.status === "ongoing" && drinks.length > 0) {
    const lastDrinkWithBAC = drinks[drinks.length - 1];
    currentBAC = lastDrinkWithBAC.bac_calculation;
  }

  // Step 8: Fetch current user threshold
  let currentThreshold = null;
  try {
    const { data: thresholdData, error: thresholdError } = await supabase
      .from("userthresholds")
      .select("threshold_bac")
      .eq("user_id", userId)
      .eq("is_current", true)
      .maybeSingle();
    if (!thresholdError && thresholdData && typeof thresholdData.threshold_bac === "number") {
      currentThreshold = thresholdData.threshold_bac;
    }
  } catch (e) {
    logError("Failed to fetch current user threshold", { userId, partyId, error: e });
  }

  // Step 9: Assemble PartyDetailDTO
  const partyDetail: PartyDetailDTO = {
    id: party.id,
    user_id: party.user_id,
    status: party.status,
    started_at: new Date(party.started_at).toISOString(),
    ended_at: party.ended_at ? new Date(party.ended_at).toISOString() : null,
    bac_estimate_max: party.bac_estimate_max,
    total_drinks_count: party.total_drinks_count,
    total_ml_consumed: party.total_ml_consumed,
    blackout_marked: party.blackout_marked,
    blackout_marked_at: party.blackout_marked_at ? new Date(party.blackout_marked_at).toISOString() : null,
    profile_snapshot: parseProfileSnapshot(party.profile_snapshot),
    created_at: party.created_at ? new Date(party.created_at).toISOString() : new Date().toISOString(),
    updated_at: party.updated_at ? new Date(party.updated_at).toISOString() : new Date().toISOString(),
    drinks,
    current_bac: currentBAC,
    active_alerts: allAlerts.filter((a) => a.is_active),
    all_alerts: allAlerts,
    current_threshold: currentThreshold ?? 0,
  };

  logInfo("Party details retrieved successfully", {
    userId,
    partyId,
    drinksCount: drinks.length,
    allAlertsCount: allAlerts.length,
    hasCurrentBAC: currentBAC !== null,
  });

  return partyDetail;
}

/**
 * Closes an ongoing party session
 *
 * This function:
 * - Verifies the party exists and belongs to the user
 * - Checks if party is not already closed
 * - Validates ended_at timestamp (must be after start, not too far in future)
 * - Updates party status to 'closed' and sets ended_at
 * - Deactivates all active alerts for this party
 * - Logs a 'party_closed' event
 *
 * @param supabase - Supabase client instance
 * @param userId - The authenticated user's UUID
 * @param partyId - The party ID to close
 * @param command - Close party command with optional ended_at timestamp
 * @returns ClosePartyResponseDTO with updated party information
 * @throws Error with specific message for business logic violations:
 *   - 'PARTY_NOT_FOUND' if party doesn't exist or user doesn't own it
 *   - 'PARTY_ALREADY_CLOSED' if party is already closed
 *   - 'INVALID_ENDED_AT' if timestamp validation fails
 */
export async function closeParty(
  supabase: SupabaseClient,
  userId: string,
  partyId: number,
  command: ClosePartyCommand
): Promise<ClosePartyResponseDTO> {
  // Step 3a: Fetch party and verify ownership
  const { data: party, error: fetchError } = await supabase
    .from("parties")
    .select("id, user_id, status, started_at, ended_at, bac_estimate_max, total_drinks_count, total_ml_consumed")
    .eq("id", partyId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !party) {
    logError("Failed to fetch party for closing", {
      userId,
      partyId,
      error: fetchError?.message || "Party not found",
    });
    throw new Error(ERROR_CODES.PARTY_NOT_FOUND);
  }

  // Step 3b: Validate party status
  if (party.status === "closed") {
    logInfo("Attempt to close already closed party", {
      userId,
      partyId,
      status: party.status,
    });
    throw new Error(ERROR_CODES.PARTY_ALREADY_CLOSED);
  }

  // Step 3c: Validate ended_at timestamp
  const endedAt = command.ended_at ? new Date(command.ended_at) : new Date();
  const startedAt = new Date(party.started_at);
  const now = new Date();

  // Check if ended_at is not before started_at
  if (endedAt < startedAt) {
    logInfo("Invalid ended_at: before party start", {
      userId,
      partyId,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
    });
    throw new Error(ERROR_CODES.INVALID_ENDED_AT);
  }

  // Check if ended_at is not too far in the past (with 5 min tolerance)
  const minAllowedTime = new Date(now.getTime() - 5 * 60 * 1000);
  if (endedAt < minAllowedTime) {
    logInfo("Invalid ended_at: too far in past", {
      userId,
      partyId,
      endedAt: endedAt.toISOString(),
      minAllowed: minAllowedTime.toISOString(),
    });
    throw new Error(ERROR_CODES.VALIDATION_FAILED);
  }

  // Check if ended_at is not in the future (with 5 min tolerance)
  const maxAllowedTime = new Date(now.getTime() + 5 * 60 * 1000);
  if (endedAt > maxAllowedTime) {
    logInfo("Invalid ended_at: too far in future", {
      userId,
      partyId,
      endedAt: endedAt.toISOString(),
      maxAllowed: maxAllowedTime.toISOString(),
    });
    throw new Error(ERROR_CODES.INVALID_ENDED_AT);
  }

  // Step 3d: Update party
  const { data: updatedParty, error: updateError } = await supabase
    .from("parties")
    .update({
      status: "closed" as const,
      ended_at: endedAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", partyId)
    .eq("user_id", userId)
    .select("id, status, started_at, ended_at, bac_estimate_max, total_drinks_count, total_ml_consumed")
    .single();

  if (updateError || !updatedParty) {
    logError("Failed to update party status to closed", {
      userId,
      partyId,
      error: updateError?.message || "Update failed",
    });
    throw updateError || new Error("Failed to update party");
  }

  // Step 3e: Deactivate all alerts (non-critical - don't throw on error)
  const { error: alertsError } = await supabase
    .from("alerts")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("party_id", partyId)
    .eq("user_id", userId)
    .eq("is_active", true);

  if (alertsError) {
    logError("Failed to deactivate alerts", {
      userId,
      partyId,
      error: alertsError.message,
    });
    // Don't throw - this is non-critical
  }

  // Step 3f: Log event (non-critical - don't throw on error)
  await new EventService(supabase).logEvent(userId, {
    event_type: "party_closed",
    party_id: BigInt(partyId),
  });

  // Step 3g: Return formatted response
  const response: ClosePartyResponseDTO = {
    id: updatedParty.id,
    status: updatedParty.status as PartyStatus,
    started_at: new Date(updatedParty.started_at).toISOString(),
    ended_at: updatedParty.ended_at ? new Date(updatedParty.ended_at).toISOString() : endedAt.toISOString(),
    bac_estimate_max: updatedParty.bac_estimate_max,
    total_drinks_count: updatedParty.total_drinks_count,
    total_ml_consumed: updatedParty.total_ml_consumed,
  };

  logInfo("Party closed successfully", {
    userId,
    partyId,
    endedAt: response.ended_at,
    totalDrinks: response.total_drinks_count,
    maxBAC: response.bac_estimate_max,
  });

  return response;
}

/**
 * Mark a party as ended with blackout and adjust user threshold
 *
 * Business logic flow:
 * 1. Fetch party and validate ownership
 * 2. Verify party is closed (status = 'closed')
 * 3. Get maximum BAC from party calculations
 * 4. Update party with blackout flag (always true)
 * 5. Deactivate previous user thresholds
 * 6. Create new threshold based on max BAC
 * 7. Log blackout_marked and threshold_adjusted events
 *
 * @param supabase - Supabase client instance
 * @param partyId - ID of the party to mark
 * @param userId - The authenticated user's UUID
 * @returns Response with party details and new threshold
 * @throws Error with appropriate status code and message
 */
export async function markBlackout(
  supabase: SupabaseClient,
  partyId: number,
  userId: string
): Promise<MarkBlackoutResponseDTO> {
  // Step 1: Verify party exists and belongs to user
  const party = (await verifyPartyOwnershipOrThrow(supabase, partyId, userId)) as Party;

  // Step 2: Verify party is closed
  if (party.status !== "closed") {
    logError("Cannot mark blackout for unclosed party", {
      userId,
      partyId,
      status: party.status,
    });
    throw {
      status: 400,
      code: ERROR_CODES.PARTY_ALREADY_ONGOING,
      message: "Cannot mark blackout for a party that is not closed",
    };
  }

  // Step 3: Get maximum BAC from calculations
  const { data: bacCalc, error: bacError } = await supabase
    .from("baccalculations")
    .select("calculated_bac")
    .eq("party_id", partyId)
    .order("calculated_bac", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (bacError) {
    logError("Failed to fetch BAC calculations", {
      userId,
      partyId,
      error: bacError.message,
    });
    throw {
      status: 500,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: "Failed to process BAC calculations",
    };
  }

  if (!bacCalc || bacCalc.calculated_bac === null) {
    logError("No BAC calculations found for party", { userId, partyId });
    throw {
      status: 400,
      code: ERROR_CODES.NO_BAC_CALCULATIONS,
      message: "Cannot mark blackout for party without BAC calculations. Please add at least one drink.",
    };
  }

  const maxBAC = bacCalc.calculated_bac;
  const now = new Date().toISOString();

  // Nowy próg po blackout = maxBAC, ale nie mniej niż minimalny
  // (nie ograniczamy górą, tylko dołem)
  const newThresholdValue = Math.max(BLACKOUT_MIN_THRESHOLD_BAC, maxBAC);

  // Step 4: Update party with blackout flag (always true)
  const { data: updatedParty, error: updateError } = await supabase
    .from("parties")
    .update({
      blackout_marked: true,
      blackout_marked_at: now,
      updated_at: now,
    })
    .eq("id", partyId)
    .select()
    .single();

  if (updateError || !updatedParty) {
    logError("Failed to update party", {
      userId,
      partyId,
      error: updateError?.message,
    });
    throw {
      status: 500,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: "Failed to update party",
    };
  }

  // Step 5: Deactivate previous user thresholds
  const { error: deactivateError } = await supabase
    .from("userthresholds")
    .update({ is_current: false })
    .eq("user_id", userId)
    .eq("is_current", true);

  if (deactivateError) {
    logError("Failed to deactivate previous thresholds", {
      userId,
      partyId,
      error: deactivateError.message,
    });
    throw {
      status: 500,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: "Failed to update user thresholds",
    };
  }

  // Step 6: Create new threshold based on max BAC
  const { data: newThreshold, error: thresholdError } = await supabase
    .from("userthresholds")
    .insert({
      user_id: userId,
      threshold_bac: newThresholdValue,
      is_current: true,
      reason: "blackout_marked",
      trigger_party_id: partyId,
      created_at: now,
    })
    .select()
    .single();

  if (thresholdError || !newThreshold) {
    logError("Failed to create new threshold", {
      userId,
      partyId,
      maxBAC,
      newThresholdValue,
      error: thresholdError?.message,
    });
    throw {
      status: 500,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: "Failed to create new threshold",
    };
  }

  // Step 7a: Log blackout_marked event (non-critical)
  await new EventService(supabase).logEvent(userId, {
    event_type: "blackout_marked",
    party_id: BigInt(partyId),
  });

  // Step 7b: Log threshold_adjusted event (non-critical)
  await new EventService(supabase).logEvent(userId, {
    event_type: "threshold_adjusted",
    party_id: BigInt(partyId),
  });

  // Step 8: Pobierz i zwróć najnowszy próg z bazy (zawsze is_current = true)
  const { data: currentThreshold, error: currentError } = await supabase
    .from("userthresholds")
    .select("id, user_id, threshold_bac, is_current, reason, trigger_party_id, created_at")
    .eq("user_id", userId)
    .eq("is_current", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (currentError || !currentThreshold) {
    logError("Failed to fetch current threshold after blackout", {
      userId,
      partyId,
      error: currentError?.message,
    });
    throw {
      status: 500,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: "Failed to fetch current threshold after blackout",
    };
  }

  // Mapuj currentThreshold do UserThresholdDTO (upewnij się, że typy są zgodne)
  const mappedThreshold = {
    id: Number(currentThreshold.id),
    user_id: String(currentThreshold.user_id),
    threshold_bac:
      typeof currentThreshold.threshold_bac === "number"
        ? currentThreshold.threshold_bac
        : Number(currentThreshold.threshold_bac),
    is_current: Boolean(currentThreshold.is_current),
    reason: currentThreshold.reason as "blackout_marked" | "manual_override" | "default",
    trigger_party_id:
      currentThreshold.trigger_party_id !== null && currentThreshold.trigger_party_id !== undefined
        ? Number(currentThreshold.trigger_party_id)
        : null,
    created_at:
      currentThreshold.created_at !== null && currentThreshold.created_at !== undefined
        ? new Date(currentThreshold.created_at).toISOString()
        : new Date().toISOString(),
  };

  const response: MarkBlackoutResponseDTO = {
    id: updatedParty.id,
    blackout_marked: updatedParty.blackout_marked ?? false,
    blackout_marked_at: updatedParty.blackout_marked_at,
    new_threshold: mappedThreshold,
  };

  logInfo("Blackout marked successfully", {
    userId,
    partyId,
    maxBAC,
    newThreshold: currentThreshold.threshold_bac,
    adjustedFromMaxBAC: maxBAC !== newThresholdValue,
  });

  return response;
}
