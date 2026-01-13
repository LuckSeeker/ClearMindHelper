/**
 * Drink Service
 *
 * Handles business logic for drink operations including:
 * - Adding drinks to parties
 * - Validating drink entries (unrealistic volumes, fast consumption)
 * - BAC calculation using Widmark formula
 * - Alert management (approaching/exceeding threshold)
 * - Party statistics updates
 * - Event logging
 */

import type { SupabaseClient } from "../../db/supabase.client";
import type { Json } from "../../db/database.types";
import type {
  AddDrinkCommand,
  AddDrinkResponseDTO,
  DrinkDTO,
  BACCalculationDTO,
  DrinkValidationWarning,
  AlertDTO,
  ProfileSnapshot,
  Party,
  Drink,
  Alert,
} from "../../types";
import { logError, logInfo } from "../logger";
import { logEvent } from "./event.service";

// ============================================================================
// Constants
// ============================================================================

/** Ethanol density in g/ml (physical constant) */
const ETHANOL_DENSITY = 0.789;

/** Unrealistic volume threshold in ml */
const UNREALISTIC_VOLUME_THRESHOLD = 2000;

/** Fast consumption time threshold in minutes */
const FAST_CONSUMPTION_THRESHOLD_MINUTES = 15;

/** BAC approaching threshold multiplier (90% of threshold) */
const APPROACHING_THRESHOLD_MULTIPLIER = 0.9;

/** Maximum BAC allowed in database (decimal(4,2) limit) */
const MAX_BAC_LIMIT = 0.99;

/** Default metabolization rate in grams per hour */
const DEFAULT_METABOLIZATION_RATE = 7.5;

/** Widmark factor for male */
const WIDMARK_R_MALE = 0.68;

/** Widmark factor for female */
const WIDMARK_R_FEMALE = 0.55;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validates party is ongoing and belongs to user
 *
 * @param party - Party entity to validate
 * @param userId - Authenticated user ID
 * @returns Validation result with error details
 */
export function validatePartyForDrink(
  party: Party | null,
  userId: string
): { valid: boolean; error?: { code: string; message: string }; status?: number } {
  if (!party) {
    return {
      valid: false,
      error: {
        code: "PARTY_NOT_FOUND",
        message: "Party not found",
      },
      status: 404,
    };
  }

  if (party.user_id !== userId) {
    return {
      valid: false,
      error: {
        code: "FORBIDDEN",
        message: "You don't have permission to access this party",
      },
      status: 403,
    };
  }

  if (party.status !== "ongoing") {
    return {
      valid: false,
      error: {
        code: "PARTY_CLOSED",
        message: "Cannot add drinks to a closed party",
      },
      status: 400,
    };
  }

  return { valid: true };
}

/**
 * Validates consumed_at is within party timeframe
 *
 * @param consumedAt - Drink consumption timestamp
 * @param party - Party entity
 * @returns Validation result
 */
export function validateConsumedAtInPartyTimeframe(
  consumedAt: Date,
  party: Party
): { valid: boolean; error?: { code: string; message: string } } {
  const startedAt = new Date(party.started_at);
  const endedAt = party.ended_at ? new Date(party.ended_at) : null;

  if (consumedAt < startedAt) {
    return {
      valid: false,
      error: {
        code: "CONSUMED_AT_BEFORE_PARTY_START",
        message: "consumed_at cannot be before party start time",
      },
    };
  }

  if (endedAt && consumedAt > endedAt) {
    return {
      valid: false,
      error: {
        code: "CONSUMED_AT_AFTER_PARTY_END",
        message: "consumed_at cannot be after party end time",
      },
    };
  }

  const now = new Date();
  if (consumedAt > now) {
    return {
      valid: false,
      error: {
        code: "CONSUMED_AT_IN_FUTURE",
        message: "consumed_at cannot be in the future",
      },
    };
  }

  return { valid: true };
}

/**
 * Checks for unrealistic drink volume
 *
 * @param volumeMl - Drink volume in ml
 * @returns Warning if volume is unrealistic
 */
export function checkUnrealisticVolume(volumeMl: number): DrinkValidationWarning | null {
  if (volumeMl > UNREALISTIC_VOLUME_THRESHOLD) {
    return {
      code: "UNREALISTIC_VOLUME",
      message: `Volume of ${volumeMl}ml is unusually large. Are you sure this is correct?`,
      field: "volume_ml",
      value: volumeMl,
    };
  }
  return null;
}

/**
 * Checks for fast consumption based on last drink
 *
 * @param consumedAt - Current drink consumption time
 * @param lastDrink - Previous drink in party
 * @returns Warning if consumption is too fast
 */
export function checkFastConsumption(consumedAt: Date, lastDrink: Drink | null): DrinkValidationWarning | null {
  if (!lastDrink) {
    return null; // First drink, no warning
  }

  const lastConsumedAt = new Date(lastDrink.consumed_at);
  const timeDiffMinutes = (consumedAt.getTime() - lastConsumedAt.getTime()) / (1000 * 60);

  if (timeDiffMinutes < FAST_CONSUMPTION_THRESHOLD_MINUTES) {
    return {
      code: "FAST_CONSUMPTION",
      message: `Only ${Math.round(timeDiffMinutes)} minutes since last drink. Consider slowing down.`,
      field: "consumed_at",
      value: timeDiffMinutes,
    };
  }

  return null;
}

/**
 * Validates that drink would not cause BAC to exceed database limit
 *
 * @param volumeMl - Drink volume in ml
 * @param abvPercent - Alcohol by volume percentage
 * @param currentTotalAlcohol - Current total alcohol consumed in grams
 * @param profileSnapshot - User profile snapshot
 * @param timeElapsedHours - Time elapsed since party start
 * @returns Error if BAC would exceed limit
 */
export function validateBACLimit(
  volumeMl: number,
  abvPercent: number,
  currentTotalAlcohol: number,
  profileSnapshot: ProfileSnapshot,
  timeElapsedHours: number
): { valid: boolean; error?: { code: string; message: string } } {
  // Calculate what BAC would be with this drink
  const newAlcoholGrams = calculateAlcoholGrams(volumeMl, abvPercent);
  const totalWithNewDrink = currentTotalAlcohol + newAlcoholGrams;
  const projectedBAC = calculateBAC(totalWithNewDrink, profileSnapshot, timeElapsedHours);

  if (projectedBAC > MAX_BAC_LIMIT) {
    return {
      valid: false,
      error: {
        code: "BAC_LIMIT_EXCEEDED",
        message: `This drink would result in BAC of ${projectedBAC.toFixed(2)}%, which exceeds the maximum allowed value of ${MAX_BAC_LIMIT}%. Please reduce volume or ABV.`,
      },
    };
  }

  return { valid: true };
}

/**
 * Calculates alcohol grams from volume and ABV
 *
 * @param volumeMl - Volume in ml
 * @param abvPercent - Alcohol by volume percentage
 * @returns Alcohol content in grams
 */
export function calculateAlcoholGrams(volumeMl: number, abvPercent: number): number {
  return (volumeMl * abvPercent * ETHANOL_DENSITY) / 100;
}

/**
 * Calculates BAC using Widmark formula
 *
 * Formula: BAC = (alcohol_grams / (body_weight_grams * r)) * 100
 * Where r is Widmark factor (0.68 for male, 0.55 for female)
 *
 * @param totalAlcoholGrams - Total alcohol consumed in grams
 * @param profileSnapshot - User profile at party start
 * @param timeElapsedHours - Time elapsed since party start
 * @param metabolizationRate - Alcohol metabolization rate in g/hour
 * @returns BAC percentage
 */
export function calculateBAC(
  totalAlcoholGrams: number,
  profileSnapshot: ProfileSnapshot,
  timeElapsedHours: number,
  metabolizationRate: number = DEFAULT_METABOLIZATION_RATE
): number {
  const bodyWeightGrams = profileSnapshot.weight_kg * 1000;
  const widmarkR = profileSnapshot.gender === "M" ? WIDMARK_R_MALE : WIDMARK_R_FEMALE;

  // Calculate initial BAC
  const initialBAC = (totalAlcoholGrams / (bodyWeightGrams * widmarkR)) * 100;

  // Calculate metabolized alcohol
  const metabolizedAlcohol = timeElapsedHours * metabolizationRate;

  // Adjust BAC for metabolism
  const metabolizedBAC = (metabolizedAlcohol / (bodyWeightGrams * widmarkR)) * 100;
  const adjustedBAC = Math.max(0, initialBAC - metabolizedBAC);

  return adjustedBAC;
}

/**
 * Gets or creates user threshold
 *
 * @param supabase - Supabase client
 * @param userId - User ID
 * @returns Current threshold or default 0.08
 */
export async function getUserThreshold(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("userthresholds")
    .select("threshold_bac")
    .eq("user_id", userId)
    .eq("is_current", true)
    .maybeSingle();

  if (error) {
    logError("Failed to get user threshold", { userId, error: error.message });
    throw new Error(`Database error: ${error.message}`);
  }

  // Return default threshold if none exists
  return data?.threshold_bac ?? 0.08;
}

/**
 * Gets last drink in party
 *
 * @param supabase - Supabase client
 * @param partyId - Party ID
 * @returns Last drink or null if no drinks
 */
export async function getLastDrink(supabase: SupabaseClient, partyId: number): Promise<Drink | null> {
  const { data, error } = await supabase
    .from("drinks")
    .select("*")
    .eq("party_id", partyId)
    .order("consumed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logError("Failed to get last drink", { partyId, error: error.message });
    throw new Error(`Database error: ${error.message}`);
  }

  return data;
}

/**
 * Gets total alcohol consumed in party
 *
 * @param supabase - Supabase client
 * @param partyId - Party ID
 * @returns Total alcohol in grams
 */
export async function getTotalAlcoholConsumed(supabase: SupabaseClient, partyId: number): Promise<number> {
  const { data, error } = await supabase.from("drinks").select("volume_ml, abv_percent").eq("party_id", partyId);

  if (error) {
    logError("Failed to calculate total alcohol", { partyId, error: error.message });
    throw new Error(`Database error: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return 0;
  }

  return data.reduce((total, drink) => {
    return total + calculateAlcoholGrams(drink.volume_ml, drink.abv_percent);
  }, 0);
}

/**
 * Creates or updates alert
 *
 * @param supabase - Supabase client
 * @param partyId - Party ID
 * @param userId - User ID
 * @param alertType - Type of alert
 * @param calculatedBAC - Current BAC value
 * @returns Created or updated alert
 */
export async function manageAlert(
  supabase: SupabaseClient,
  partyId: number,
  userId: string,
  alertType: "approaching_threshold" | "exceeded_threshold",
  calculatedBAC: number
): Promise<Alert> {
  // Check if alert already exists
  const { data: existingAlert, error: fetchError } = await supabase
    .from("alerts")
    .select("*")
    .eq("party_id", partyId)
    .eq("alert_type", alertType)
    .eq("is_active", true)
    .maybeSingle();

  if (fetchError) {
    logError("Failed to fetch existing alert", { partyId, alertType, error: fetchError.message });
    throw new Error(`Database error: ${fetchError.message}`);
  }

  if (existingAlert) {
    // Update existing alert
    const { data: updatedAlert, error: updateError } = await supabase
      .from("alerts")
      .update({
        bac_at_alert: calculatedBAC,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingAlert.id)
      .select()
      .single();

    if (updateError) {
      logError("Failed to update alert", { alertId: existingAlert.id, error: updateError.message });
      throw new Error(`Database error: ${updateError.message}`);
    }

    return updatedAlert;
  } else {
    // Create new alert
    const { data: newAlert, error: insertError } = await supabase
      .from("alerts")
      .insert({
        user_id: userId,
        party_id: partyId,
        alert_type: alertType,
        bac_at_alert: calculatedBAC,
        is_active: true,
        triggered_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      logError("Failed to create alert", { partyId, alertType, error: insertError.message });
      throw new Error(`Database error: ${insertError.message}`);
    }

    return newAlert;
  }
}

/**
 * Gets active alerts for party
 *
 * @param supabase - Supabase client
 * @param partyId - Party ID
 * @returns List of active alerts
 */
export async function getActiveAlerts(supabase: SupabaseClient, partyId: number): Promise<AlertDTO[]> {
  const { data, error } = await supabase
    .from("alerts")
    .select("*")
    .eq("party_id", partyId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    logError("Failed to get active alerts", { partyId, error: error.message });
    throw new Error(`Database error: ${error.message}`);
  }

  return (data || []).map((alert) => ({
    ...alert,
    created_at: alert.created_at ?? new Date().toISOString(),
    updated_at: alert.updated_at ?? new Date().toISOString(),
  }));
}

// ============================================================================
// Main Service Function
// ============================================================================

/**
 * Adds a drink to a party
 *
 * This is the main orchestration function that:
 * 1. Validates party and permissions
 * 2. Validates consumed_at timeframe
 * 3. Validates BAC limit would not be exceeded
 * 4. Checks for validation warnings
 * 5. Creates drink record
 * 6. Calculates BAC
 * 7. Manages alerts
 * 8. Updates party statistics
 * 9. Logs events
 *
 * @param supabase - Supabase client
 * @param userId - Authenticated user ID
 * @param partyId - Party ID
 * @param command - Add drink command
 * @returns Response with drink, BAC, warnings, and alerts
 */
export async function addDrinkToParty(
  supabase: SupabaseClient,
  userId: string,
  partyId: number,
  command: AddDrinkCommand
): Promise<AddDrinkResponseDTO> {
  logInfo("Adding drink to party", { userId, partyId, command });

  // 1. Validate party exists and belongs to user
  const { data: party, error: partyError } = await supabase.from("parties").select("*").eq("id", partyId).maybeSingle();

  if (partyError) {
    logError("Failed to fetch party", { partyId, error: partyError.message });
    throw new Error(`Database error: ${partyError.message}`);
  }

  const validation = validatePartyForDrink(party, userId);

  if (!validation.valid && validation.error) {
    const error = new Error(validation.error.message) as Error & {
      code: string;
      status: number;
    };
    error.code = validation.error.code;
    error.status = validation.status ?? 500;
    throw error;
  }

  // Type guard: at this point party is not null
  if (!party) {
    throw new Error("Party validation passed but party is null");
  }

  // 2. Validate consumed_at is within party timeframe
  const consumedAt = command.consumed_at ? new Date(command.consumed_at) : new Date();
  const timeframeValidation = validateConsumedAtInPartyTimeframe(consumedAt, party);

  if (!timeframeValidation.valid && timeframeValidation.error) {
    const error = new Error(timeframeValidation.error.message) as Error & {
      code: string;
      status: number;
    };
    error.code = timeframeValidation.error.code;
    error.status = 400;
    throw error;
  }

  // 3. Validate BAC limit would not be exceeded
  const partyStartTime = new Date(party.started_at);
  const timeElapsedHours = (consumedAt.getTime() - partyStartTime.getTime()) / (1000 * 60 * 60);
  const currentTotalAlcohol = await getTotalAlcoholConsumed(supabase, partyId);
  const profileSnapshot = party.profile_snapshot as unknown as ProfileSnapshot;

  const bacLimitValidation = validateBACLimit(
    command.volume_ml,
    command.abv_percent,
    currentTotalAlcohol,
    profileSnapshot,
    timeElapsedHours
  );

  if (!bacLimitValidation.valid && bacLimitValidation.error) {
    const error = new Error(bacLimitValidation.error.message) as Error & {
      code: string;
      status: number;
    };
    error.code = bacLimitValidation.error.code;
    error.status = 400;
    throw error;
  }

  // 4. Check for validation warnings
  const warnings: DrinkValidationWarning[] = [];

  // Check unrealistic volume
  const volumeWarning = checkUnrealisticVolume(command.volume_ml);
  if (volumeWarning) {
    warnings.push(volumeWarning);
  }

  // Check fast consumption
  const lastDrink = await getLastDrink(supabase, partyId);
  const fastConsumptionWarning = checkFastConsumption(consumedAt, lastDrink);
  if (fastConsumptionWarning) {
    warnings.push(fastConsumptionWarning);
  }

  // If warnings exist and not confirmed, return 422
  if (warnings.length > 0 && !command.confirm_warnings) {
    const error = new Error("Validation warnings require confirmation") as Error & {
      code: string;
      status: number;
      warnings: DrinkValidationWarning[];
    };
    error.code = "VALIDATION_WARNINGS";
    error.status = 422;
    error.warnings = warnings;
    throw error;
  }

  // 5. Calculate order_sequence
  const { data: maxOrderData } = await supabase
    .from("drinks")
    .select("order_sequence")
    .eq("party_id", partyId)
    .order("order_sequence", { ascending: false })
    .limit(1)
    .maybeSingle();

  const orderSequence = (maxOrderData?.order_sequence ?? 0) + 1;

  // 6. Create drink record
  const { data: drink, error: drinkError } = await supabase
    .from("drinks")
    .insert({
      party_id: partyId,
      user_id: userId,
      volume_ml: command.volume_ml,
      abv_percent: command.abv_percent,
      consumed_at: consumedAt.toISOString(),
      order_sequence: orderSequence,
    })
    .select()
    .single();

  if (drinkError) {
    logError("Failed to create drink", { partyId, error: drinkError.message });
    throw new Error(`Database error: ${drinkError.message}`);
  }

  // 7. Calculate BAC
  const totalAlcoholGrams = await getTotalAlcoholConsumed(supabase, partyId);
  const timeElapsedMinutes = Math.round(timeElapsedHours * 60);

  const calculatedBAC = calculateBAC(totalAlcoholGrams, profileSnapshot, timeElapsedHours);

  // Calculate metabolized alcohol
  const metabolizedAlcohol = timeElapsedHours * DEFAULT_METABOLIZATION_RATE;

  // 8. Insert BAC calculation
  const { data: bacCalculation, error: bacError } = await supabase
    .from("baccalculations")
    .insert({
      party_id: partyId,
      drink_id: drink.id,
      user_id: userId,
      calculated_bac: calculatedBAC,
      metabolized_alcohol_g: metabolizedAlcohol,
      time_since_first_drink_minutes: timeElapsedMinutes,
      user_profile_snapshot: profileSnapshot as unknown as Json,
      calculation_timestamp: consumedAt.toISOString(),
    })
    .select()
    .single();

  if (bacError) {
    logError("Failed to create BAC calculation", { drinkId: drink.id, error: bacError.message });
    throw new Error(`Database error: ${bacError.message}`);
  }

  // 9. Get user threshold and manage alerts
  const thresholdBAC = await getUserThreshold(supabase, userId);
  const alertsList: Alert[] = [];

  if (calculatedBAC >= APPROACHING_THRESHOLD_MULTIPLIER * thresholdBAC) {
    const alert = await manageAlert(supabase, partyId, userId, "approaching_threshold", calculatedBAC);
    alertsList.push(alert);
  }

  if (calculatedBAC >= thresholdBAC) {
    const alert = await manageAlert(supabase, partyId, userId, "exceeded_threshold", calculatedBAC);
    alertsList.push(alert);
  }

  // 10. Update party BAC max (total_drinks_count and total_ml_consumed are updated by database trigger)
  const { data: currentParty } = await supabase.from("parties").select("bac_estimate_max").eq("id", partyId).single();

  const newMaxBAC = Math.max(currentParty?.bac_estimate_max ?? 0, calculatedBAC);

  await supabase.from("parties").update({ bac_estimate_max: newMaxBAC }).eq("id", partyId);

  // 11. Log events
  await logEvent(supabase, userId, "drink_added", partyId);

  if (fastConsumptionWarning) {
    await logEvent(supabase, userId, "fast_consumption_warning", partyId);
  }

  // 12. Get all active alerts
  const activeAlerts = await getActiveAlerts(supabase, partyId);

  // 13. Build response
  const drinkDTO: DrinkDTO = {
    ...drink,
    created_at: drink.created_at ?? new Date().toISOString(),
    updated_at: drink.updated_at ?? new Date().toISOString(),
  };

  const bacCalculationDTO: BACCalculationDTO = {
    ...bacCalculation,
    user_profile_snapshot: profileSnapshot,
    calculation_timestamp: bacCalculation.calculation_timestamp ?? new Date().toISOString(),
    created_at: bacCalculation.created_at ?? new Date().toISOString(),
  };

  logInfo("Successfully added drink to party", { drinkId: drink.id, bac: calculatedBAC });

  return {
    drink: drinkDTO,
    bac_calculation: bacCalculationDTO,
    warnings,
    active_alerts: activeAlerts,
  };
}
