/**
 * BAC (Blood Alcohol Concentration) Service
 *
 * Provides real-time BAC calculations using Widmark algorithm
 * for time-based alcohol metabolism modeling.
 */

import type { SupabaseClient } from "../../db/supabase.client";
import type { CurrentBACResponseDTO, ProfileSnapshot, BACHistoryResponseDTO, BACCalculationDTO } from "../../types";
import { ERROR_CODES } from "../constants";
import { parseProfileSnapshot } from "../type-guards";

import { WIDMARK_CONSTANTS } from "../constants";

// ============================================================================
// Internal Types (not exported, only for service layer)
// ============================================================================

/**
 * Internal type for BAC decay calculation
 */
interface BACDecayCalculation {
  original_bac: number;
  time_elapsed_minutes: number;
  metabolism_rate_per_hour: number;
  metabolized_bac: number;
  current_bac: number;
}

/**
 * Threshold status determination
 */
type ThresholdStatus = "safe" | "approaching" | "exceeded";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get water distribution coefficient based on gender
 */
export function getWaterDistributionCoefficient(gender: "M" | "F"): number {
  return gender === "M" ? WIDMARK_CONSTANTS.MALE_R : WIDMARK_CONSTANTS.FEMALE_R;
}

/**
 * Calculate time elapsed in minutes between two timestamps
 */
export function getTimeElapsedMinutes(from: string, to: string): number {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  return Math.floor((toDate.getTime() - fromDate.getTime()) / 1000 / 60);
}

/**
 * Calculate BAC decrease rate per hour for a person
 *
 * @param profileSnapshot - User profile (weight, gender)
 * @returns BAC decrease in ‰ per hour
 */
export function getBACDecreasePerHour(profileSnapshot: ProfileSnapshot): number {
  const r = getWaterDistributionCoefficient(profileSnapshot.gender);
  const alcoholMetabolizedGramsPerHour = WIDMARK_CONSTANTS.METABOLISM_RATE_PER_KG_PER_HOUR * profileSnapshot.weight_kg;

  // Convert grams to BAC decrease using Widmark formula
  // BAC (‰) = alcohol_g / (weight_kg * r)
  // Note: Do NOT multiply by 10 - the formula already gives promilles
  return alcoholMetabolizedGramsPerHour / (profileSnapshot.weight_kg * r);
}

/**
 * Calculate current BAC with time-based decay using Widmark algorithm
 *
 * @param originalBAC - BAC value from last calculation
 * @param calculatedAt - Timestamp when last BAC was calculated
 * @param profileSnapshot - User profile data for metabolism calculation
 * @returns Decay calculation details
 */
export function calculateBACDecay(
  originalBAC: number,
  calculatedAt: string,
  profileSnapshot: ProfileSnapshot
): BACDecayCalculation {
  const now = new Date().toISOString();
  const timeElapsedMinutes = getTimeElapsedMinutes(calculatedAt, now);
  const timeElapsedHours = timeElapsedMinutes / 60;

  const bacDecreasePerHour = getBACDecreasePerHour(profileSnapshot);
  const metabolizedBAC = bacDecreasePerHour * timeElapsedHours;
  const currentBAC = Math.max(0, originalBAC - metabolizedBAC);

  return {
    original_bac: originalBAC,
    time_elapsed_minutes: timeElapsedMinutes,
    metabolism_rate_per_hour: bacDecreasePerHour,
    metabolized_bac: metabolizedBAC,
    current_bac: currentBAC,
  };
}

/**
 * Determine threshold status based on current BAC and user threshold
 *
 * @param currentBAC - Current BAC value in ‰
 * @param threshold - User's threshold in ‰
 * @returns Status: "safe", "approaching", or "exceeded"
 */
export function determineThresholdStatus(currentBAC: number, threshold: number): ThresholdStatus {
  if (currentBAC >= threshold) {
    return "exceeded";
  }

  const approachingThreshold = WIDMARK_CONSTANTS.APPROACHING_THRESHOLD_RATIO * threshold;
  if (currentBAC >= approachingThreshold) {
    return "approaching";
  }

  return "safe";
}

/**
 * Calculate estimated time to reach BAC = 0.00‰
 *
 * @param currentBAC - Current BAC value in ‰
 * @param profileSnapshot - User profile for metabolism calculation
 * @returns Estimated minutes to sober, or null if already sober
 */
export function calculateTimeToSober(currentBAC: number, profileSnapshot: ProfileSnapshot): number | null {
  if (currentBAC <= 0) {
    return null;
  }

  const bacDecreasePerHour = getBACDecreasePerHour(profileSnapshot);
  const hoursToSober = currentBAC / bacDecreasePerHour;
  return Math.ceil(hoursToSober * 60);
}

// ============================================================================
// Main Service Function
// ============================================================================

/**
 * Get current BAC for an ongoing party with real-time calculation
 *
 * This function:
 * 1. Verifies party ownership and status
 * 2. Retrieves last BAC calculation as baseline
 * 3. Applies time-based decay using Widmark algorithm
 * 4. Compares with user threshold
 * 5. Calculates time to sober
 *
 * @param supabase - Supabase client with authenticated user
 * @param partyId - ID of the party
 * @param userId - Authenticated user ID
 * @returns Current BAC status with calculations
 * @throws Error with specific message for various failure scenarios
 */
export async function getCurrentBAC(
  supabase: SupabaseClient,
  partyId: number,
  userId: string
): Promise<CurrentBACResponseDTO> {
  // Step 1: Fetch party with ownership verification
  const { data: party, error: partyError } = await supabase
    .from("parties")
    .select("*")
    .eq("id", partyId)
    .eq("user_id", userId)
    .single();

  if (partyError || !party) {
    throw new Error(ERROR_CODES.PARTY_NOT_FOUND);
  }

  // Verify party status is 'ongoing'
  if (party.status !== "ongoing") {
    throw new Error(ERROR_CODES.PARTY_ALREADY_CLOSED);
  }

  // Step 2: Fetch latest BAC calculation for this party
  const { data: latestBAC, error: bacError } = await supabase
    .from("baccalculations")
    .select("*")
    .eq("party_id", partyId)
    .eq("user_id", userId)
    .order("calculation_timestamp", { ascending: false })
    .limit(1)
    .single();

  if (bacError || !latestBAC) {
    throw new Error(ERROR_CODES.NO_DRINKS_IN_PARTY);
  }

  // Step 3: Fetch first drink to calculate time_since_first_drink
  const { data: firstDrink, error: firstDrinkError } = await supabase
    .from("drinks")
    .select("consumed_at")
    .eq("party_id", partyId)
    .eq("user_id", userId)
    .order("consumed_at", { ascending: true })
    .limit(1)
    .single();

  if (firstDrinkError || !firstDrink) {
    throw new Error(ERROR_CODES.NO_DRINKS_IN_PARTY);
  }

  // Step 4: Fetch current user threshold
  const { data: threshold, error: thresholdError } = await supabase
    .from("userthresholds")
    .select("*")
    .eq("user_id", userId)
    .eq("is_current", true)
    .single();

  if (thresholdError || !threshold) {
    throw new Error(ERROR_CODES.NO_THRESHOLD_FOUND);
  }

  // Step 5: Calculate current BAC with time decay
  const profileSnapshot = parseProfileSnapshot(latestBAC.user_profile_snapshot);

  if (!latestBAC.calculation_timestamp) {
    throw new Error(ERROR_CODES.DATABASE_ERROR);
  }

  const bacDecay = calculateBACDecay(latestBAC.calculated_bac, latestBAC.calculation_timestamp, profileSnapshot);

  // Step 6: Determine threshold status
  const thresholdStatus = determineThresholdStatus(bacDecay.current_bac, threshold.threshold_bac);

  // Step 7: Calculate time to sober
  const timeToSober = calculateTimeToSober(bacDecay.current_bac, profileSnapshot);

  // Step 8: Calculate time metrics
  const now = new Date().toISOString();
  const timeSinceLastDrink = getTimeElapsedMinutes(latestBAC.calculation_timestamp, now);
  const timeSinceFirstDrink = getTimeElapsedMinutes(firstDrink.consumed_at, now);

  // Step 9: Return formatted response
  return {
    party_id: partyId,
    current_bac: Number(bacDecay.current_bac.toFixed(2)),
    calculated_at: now,
    time_since_last_drink_minutes: timeSinceLastDrink,
    time_since_first_drink_minutes: timeSinceFirstDrink,
    current_threshold: threshold.threshold_bac,
    threshold_status: thresholdStatus,
    estimated_time_to_sober_minutes: timeToSober,
  };
}

// ============================================================================
// BAC History Service Function
// ============================================================================

/**
 * Get complete BAC calculation history for a party
 *
 * This function:
 * 1. Verifies party ownership
 * 2. Retrieves all BAC calculations in chronological order
 * 3. Fetches maximum BAC from party record
 * 4. Transforms database records to DTOs
 *
 * @param supabase - Supabase client with authenticated user
 * @param partyId - ID of the party
 * @param userId - Authenticated user ID
 * @returns Complete BAC history with all calculations
 * @throws Error with specific message for various failure scenarios
 */
export async function getBACHistory(
  supabase: SupabaseClient,
  partyId: number,
  userId: string
): Promise<BACHistoryResponseDTO> {
  // Step 1: Fetch party with ownership verification and max BAC
  const { data: party, error: partyError } = await supabase
    .from("parties")
    .select("user_id, bac_estimate_max")
    .eq("id", partyId)
    .single();

  // Handle party not found
  if (partyError || !party) {
    throw new Error(ERROR_CODES.PARTY_NOT_FOUND);
  }

  // Verify ownership
  if (party.user_id !== userId) {
    throw new Error(ERROR_CODES.FORBIDDEN);
  }

  // Step 2: Fetch all BAC calculations for this party ordered chronologically
  const { data: bacCalculations, error: bacError } = await supabase
    .from("baccalculations")
    .select("*")
    .eq("party_id", partyId)
    .order("calculation_timestamp", { ascending: true });

  // Handle database errors
  if (bacError) {
    throw new Error(ERROR_CODES.DATABASE_ERROR);
  }

  // Step 3: Transform database records to DTOs
  const bacCalculationDTOs: BACCalculationDTO[] = (bacCalculations || []).map((calc) => {
    // Parse JSONB user_profile_snapshot to ProfileSnapshot
    const profileSnapshot = parseProfileSnapshot(calc.user_profile_snapshot);

    // Ensure calculation_timestamp is not null (should never happen in practice)
    if (!calc.calculation_timestamp) {
      throw new Error(ERROR_CODES.DATABASE_ERROR);
    }

    return {
      id: calc.id,
      party_id: calc.party_id,
      user_id: calc.user_id,
      drink_id: calc.drink_id,
      calculated_bac: calc.calculated_bac,
      calculation_timestamp: calc.calculation_timestamp,
      algorithm_version: calc.algorithm_version || "1.0", // Default if null
      user_profile_snapshot: profileSnapshot,
      time_since_first_drink_minutes: calc.time_since_first_drink_minutes || 0,
      metabolized_alcohol_g: calc.metabolized_alcohol_g || 0,
      created_at: calc.created_at || new Date().toISOString(),
    };
  });

  // Step 4: Return formatted response
  return {
    party_id: partyId,
    bac_calculations: bacCalculationDTOs,
    bac_estimate_max: party.bac_estimate_max,
    total_count: bacCalculationDTOs.length,
  };
}
