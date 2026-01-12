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
import type {
  PartyDTO,
  ProfileSnapshot,
  Party,
  PartyListResponseDTO,
  PartyListItemDTO,
  DrinkPreview,
  PartyStatus,
} from "../../types";
import { getUserProfile, isProfileComplete, getMissingFields } from "./profile.service";
import { logError, logInfo } from "../logger";

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
    throw new Error("PROFILE_NOT_FOUND");
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
    throw new Error("PARTY_ALREADY_ONGOING");
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

  // Step 5: Log party_started event
  try {
    await logPartyStartedEvent(supabase, userId, newParty.id);
  } catch (eventError) {
    // Event logging is non-critical, log error but don't fail the request
    logError("Failed to log party_started event", {
      userId,
      partyId: newParty.id,
      error: eventError instanceof Error ? eventError.message : "Unknown error",
    });
  }

  // Transform to DTO
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
    profile_snapshot: newParty.profile_snapshot as unknown as ProfileSnapshot,
    created_at: newParty.created_at ? new Date(newParty.created_at).toISOString() : new Date().toISOString(),
    updated_at: newParty.updated_at ? new Date(newParty.updated_at).toISOString() : new Date().toISOString(),
  };

  return partyDTO;
}

/**
 * Logs party_started event to events table
 *
 * Events table tracks important user actions for analytics and audit trail.
 * This is a fire-and-forget operation - failures are logged but don't affect
 * the party creation flow.
 *
 * @param supabase - Supabase client instance
 * @param userId - The authenticated user's UUID
 * @param partyId - The newly created party's ID
 * @throws Error if database insert fails
 */
async function logPartyStartedEvent(supabase: SupabaseClient, userId: string, partyId: number): Promise<void> {
  const { error } = await supabase.from("events").insert({
    user_id: userId,
    event_type: "party_started",
    party_id: partyId,
    event_timestamp: new Date().toISOString(),
    metadata: null,
  });

  if (error) {
    throw new Error(`Failed to log event: ${error.message}`);
  }

  logInfo("Event logged", { userId, partyId, eventType: "party_started" });
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
  let query = supabase.from("parties").select("*", { count: "exact" }).eq("user_id", userId);

  // Apply status filter if provided
  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  // Step 2: Apply sorting
  query = query.order(pagination.sort, { ascending: pagination.order === "asc" });

  // Step 3: Apply pagination
  const from = (pagination.page - 1) * pagination.limit;
  const to = from + pagination.limit - 1;
  query = query.range(from, to);

  // Execute query
  const { data: parties, error, count } = await query;

  if (error) {
    logError("Failed to fetch parties", { userId, error: error.message });
    throw new Error(`Database error: ${error.message}`);
  }

  const totalCount = count ?? 0;

  // Handle empty result
  if (!parties || parties.length === 0) {
    logInfo("No parties found", { userId, filters });
    return {
      data: [],
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total_count: totalCount,
        total_pages: 0,
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
    profile_snapshot: party.profile_snapshot as unknown as ProfileSnapshot,
    created_at: party.created_at ? new Date(party.created_at).toISOString() : new Date().toISOString(),
    updated_at: party.updated_at ? new Date(party.updated_at).toISOString() : new Date().toISOString(),
    drinks_preview: drinksByParty.get(party.id) || [],
  }));

  // Calculate pagination metadata
  const totalPages = Math.ceil(totalCount / pagination.limit);

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
