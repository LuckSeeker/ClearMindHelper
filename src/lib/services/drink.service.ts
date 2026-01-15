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
  UpdateDrinkCommand,
  UpdateDrinkResponseDTO,
  DrinkDTO,
  BACCalculationDTO,
  DrinkValidationWarning,
  AlertDTO,
  ProfileSnapshot,
  Party,
  Drink,
  Alert,
  DrinkWithBACDTO,
  PartyDrinksResponseDTO,
} from "../../types";
import { logError, logInfo } from "../logger";
import { verifyPartyOwnershipOrThrow } from "../api-helpers";
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
 * Validates party is ongoing (not closed)
 * Note: Party existence and ownership should be verified with verifyPartyOwnershipOrThrow before calling this
 *
 * @param party - Party object to validate
 * @returns Validation result with error details
 */
export function validatePartyForDrink(party: { status: string }): {
  valid: boolean;
  error?: { code: string; message: string };
  status?: number;
} {
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
 * @param party - Party entity with started_at and ended_at fields
 * @returns Validation result
 */
export function validateConsumedAtInPartyTimeframe(
  consumedAt: Date,
  party: { started_at: string; ended_at: string | null }
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

  // 1. Verify party exists and belongs to user
  const party = (await verifyPartyOwnershipOrThrow(supabase, partyId, userId)) as Party;

  // 2. Validate party status (must be ongoing)
  const validation = validatePartyForDrink(party);

  if (!validation.valid && validation.error) {
    const error = new Error(validation.error.message) as Error & {
      code: string;
      status: number;
    };
    error.code = validation.error.code;
    error.status = validation.status ?? 500;
    throw error;
  }

  // 3. Validate consumed_at is within party timeframe
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

  // 4. Validate BAC limit would not be exceeded
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

/**
 * Updates the last drink in a party
 *
 * This function:
 * 1. Validates party and permissions
 * 2. Validates drink exists and belongs to party
 * 3. Validates drink is the last one in the party
 * 4. Validates party is ongoing
 * 5. Validates BAC limit would not be exceeded with new values
 * 6. Updates drink with new values (preserves original_values on first edit)
 * 7. Recalculates BAC for the drink
 * 8. Updates party statistics (bac_estimate_max, total_ml_consumed)
 * 9. Re-evaluates alerts
 * 10. Logs event
 *
 * @param supabase - Supabase client
 * @param userId - Authenticated user ID
 * @param partyId - Party ID
 * @param drinkId - Drink ID to update
 * @param command - Update drink command
 * @returns Response with updated drink, recalculated BAC, warnings, and alerts
 */
export async function updateLastDrink(
  supabase: SupabaseClient,
  userId: string,
  partyId: number,
  drinkId: number,
  command: UpdateDrinkCommand
): Promise<UpdateDrinkResponseDTO> {
  logInfo("Updating last drink in party", { userId, partyId, drinkId, command });

  // 1. Verify party exists and belongs to user
  const party = (await verifyPartyOwnershipOrThrow(supabase, partyId, userId)) as Party;

  // 2. Validate party status (must be ongoing)
  const validation = validatePartyForDrink(party);

  if (!validation.valid && validation.error) {
    const error = new Error(validation.error.message) as Error & {
      code: string;
      status: number;
    };
    error.code = validation.error.code;
    error.status = validation.status ?? 500;
    throw error;
  }

  // 3. Validate drink exists and belongs to party
  const { data: drink, error: drinkError } = await supabase
    .from("drinks")
    .select("*")
    .eq("id", drinkId)
    .eq("party_id", partyId)
    .maybeSingle();

  if (drinkError) {
    logError("Failed to fetch drink", { drinkId, error: drinkError.message });
    throw new Error(`Database error: ${drinkError.message}`);
  }

  if (!drink) {
    const error = new Error("Drink not found") as Error & {
      code: string;
      status: number;
    };
    error.code = "DRINK_NOT_FOUND";
    error.status = 404;
    throw error;
  }

  // Verify drink belongs to the user (extra security check)
  if (drink.user_id !== userId) {
    const error = new Error("You don't have permission to edit this drink") as Error & {
      code: string;
      status: number;
    };
    error.code = "FORBIDDEN";
    error.status = 403;
    throw error;
  }

  // 4. Validate drink is the last one in party
  const { data: maxOrderData, error: maxOrderError } = await supabase
    .from("drinks")
    .select("order_sequence")
    .eq("party_id", partyId)
    .order("order_sequence", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxOrderError) {
    logError("Failed to get max order_sequence", { partyId, error: maxOrderError.message });
    throw new Error(`Database error: ${maxOrderError.message}`);
  }

  if (!maxOrderData || drink.order_sequence !== maxOrderData.order_sequence) {
    const error = new Error("Only the last drink can be edited") as Error & {
      code: string;
      status: number;
    };
    error.code = "NOT_LAST_DRINK";
    error.status = 409;
    throw error;
  }

  // 5. Validate BAC limit with updated values
  const profileSnapshot = party.profile_snapshot as unknown as ProfileSnapshot;
  const partyStartTime = new Date(party.started_at);
  const consumedAt = new Date(drink.consumed_at);
  const timeElapsedHours = (consumedAt.getTime() - partyStartTime.getTime()) / (1000 * 60 * 60);

  // Calculate total alcohol WITHOUT this drink, then add the new values
  const allDrinks = await supabase.from("drinks").select("*").eq("party_id", partyId).order("order_sequence");

  if (allDrinks.error) {
    logError("Failed to fetch all drinks", { partyId, error: allDrinks.error.message });
    throw new Error(`Database error: ${allDrinks.error.message}`);
  }

  const totalAlcoholWithoutThisDrink = (allDrinks.data || [])
    .filter((d) => d.id !== drinkId)
    .reduce((total, d) => total + calculateAlcoholGrams(d.volume_ml, d.abv_percent), 0);

  const bacLimitValidation = validateBACLimit(
    command.volume_ml,
    command.abv_percent,
    totalAlcoholWithoutThisDrink,
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

  // 6. Check for validation warnings
  const warnings: DrinkValidationWarning[] = [];
  const volumeWarning = checkUnrealisticVolume(command.volume_ml);
  if (volumeWarning) {
    warnings.push(volumeWarning);
  }

  // 7. Update drink - preserve original_values on first edit
  const currentEditCount = drink.edit_count ?? 0;
  const isFirstEdit = currentEditCount === 0;
  const updatePayload: {
    volume_ml: number;
    abv_percent: number;
    edited_at: string;
    edit_count: number;
    original_values?: { volume_ml: number; abv_percent: number };
  } = {
    volume_ml: command.volume_ml,
    abv_percent: command.abv_percent,
    edited_at: new Date().toISOString(),
    edit_count: currentEditCount + 1,
  };

  if (isFirstEdit) {
    updatePayload.original_values = {
      volume_ml: drink.volume_ml,
      abv_percent: drink.abv_percent,
    };
  }

  const { data: updatedDrink, error: updateError } = await supabase
    .from("drinks")
    .update(updatePayload)
    .eq("id", drinkId)
    .select()
    .single();

  if (updateError) {
    logError("Failed to update drink", { drinkId, error: updateError.message });
    throw new Error(`Database error: ${updateError.message}`);
  }

  // 8. Recalculate BAC for this drink
  const totalAlcoholGrams =
    totalAlcoholWithoutThisDrink + calculateAlcoholGrams(command.volume_ml, command.abv_percent);

  const calculatedBAC = calculateBAC(totalAlcoholGrams, profileSnapshot, timeElapsedHours);
  const metabolizedAlcohol = timeElapsedHours * DEFAULT_METABOLIZATION_RATE;

  // 9. Update BAC calculation
  const timeElapsedMinutes = Math.round(timeElapsedHours * 60);
  const { data: bacCalculation, error: bacUpdateError } = await supabase
    .from("baccalculations")
    .update({
      calculated_bac: calculatedBAC,
      metabolized_alcohol_g: metabolizedAlcohol,
      calculation_timestamp: new Date().toISOString(),
      time_since_first_drink_minutes: timeElapsedMinutes,
    })
    .eq("drink_id", drinkId)
    .select()
    .maybeSingle();

  if (bacUpdateError) {
    logError("Failed to update BAC calculation", { drinkId, error: bacUpdateError.message });
    throw new Error(`Database error: ${bacUpdateError.message}`);
  }

  if (!bacCalculation) {
    logError("BAC calculation not found for drink after update", { drinkId });
    throw new Error("BAC calculation not found");
  }

  // 10. Recalculate party statistics
  // Get all drinks with updated values
  const { data: allDrinksUpdated, error: allDrinksError } = await supabase
    .from("drinks")
    .select("volume_ml, abv_percent, consumed_at")
    .eq("party_id", partyId)
    .order("consumed_at");

  if (allDrinksError) {
    logError("Failed to fetch drinks for stats", { partyId, error: allDrinksError.message });
    throw new Error(`Database error: ${allDrinksError.message}`);
  }

  // Calculate max BAC across all drinks
  let maxBAC = 0;
  let cumulativeAlcohol = 0;

  for (const d of allDrinksUpdated || []) {
    cumulativeAlcohol += calculateAlcoholGrams(d.volume_ml, d.abv_percent);
    const drinkTime = new Date(d.consumed_at);
    const timeFromStart = (drinkTime.getTime() - partyStartTime.getTime()) / (1000 * 60 * 60);
    const bac = calculateBAC(cumulativeAlcohol, profileSnapshot, timeFromStart);
    maxBAC = Math.max(maxBAC, bac);
  }

  // Calculate total ml consumed
  const totalMlConsumed = (allDrinksUpdated || []).reduce((sum, d) => sum + d.volume_ml, 0);

  // Update party statistics
  await supabase
    .from("parties")
    .update({
      bac_estimate_max: maxBAC,
      total_ml_consumed: totalMlConsumed,
    })
    .eq("id", partyId);

  // 11. Re-evaluate alerts
  // Deactivate all existing alerts for this party
  await supabase.from("alerts").update({ is_active: false }).eq("party_id", partyId).eq("is_active", true);

  // Get user threshold and create new alerts if needed
  const thresholdBAC = await getUserThreshold(supabase, userId);

  if (calculatedBAC >= APPROACHING_THRESHOLD_MULTIPLIER * thresholdBAC) {
    await manageAlert(supabase, partyId, userId, "approaching_threshold", calculatedBAC);
  }

  if (calculatedBAC >= thresholdBAC) {
    await manageAlert(supabase, partyId, userId, "exceeded_threshold", calculatedBAC);
  }

  // 11. Get all active alerts
  const activeAlerts = await getActiveAlerts(supabase, partyId);

  // 12. Log event
  await logEvent(supabase, userId, "drink_edited", partyId);

  // 13. Build response
  const drinkDTO: DrinkDTO = {
    ...updatedDrink,
    created_at: updatedDrink.created_at ?? new Date().toISOString(),
    updated_at: updatedDrink.updated_at ?? new Date().toISOString(),
  };

  const bacCalculationDTO: BACCalculationDTO = {
    ...bacCalculation,
    user_profile_snapshot: profileSnapshot,
    calculation_timestamp: bacCalculation.calculation_timestamp ?? new Date().toISOString(),
    created_at: bacCalculation.created_at ?? new Date().toISOString(),
  };

  logInfo("Successfully updated last drink", { drinkId, bac: calculatedBAC });

  return {
    drink: drinkDTO,
    bac_calculation: bacCalculationDTO,
    warnings,
    active_alerts: activeAlerts,
  };
}

/**
 * Retrieves all drinks for a specific party with optional BAC calculations
 *
 * This is the main business logic for GET /api/parties/:partyId/drinks endpoint.
 * It performs the following steps:
 * 1. Fetches all drinks for the party ordered by consumed_at
 * 2. Optionally joins with BAC calculations
 * 3. Transforms database rows to DTOs
 * 4. Returns response with total count
 *
 * @param supabase - Supabase client instance
 * @param partyId - The party ID to fetch drinks for
 * @param includeBac - Whether to include BAC calculations (default: true)
 * @returns PartyDrinksResponseDTO with drinks list and metadata
 * @throws Error if database query fails
 */
export async function getDrinksByPartyId(
  supabase: SupabaseClient,
  partyId: number,
  includeBac = true
): Promise<PartyDrinksResponseDTO> {
  logInfo("Fetching drinks for party", { partyId, includeBac });

  try {
    if (includeBac) {
      // Fetch drinks with BAC calculations using LEFT JOIN
      const { data, error } = await supabase
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

      if (error) {
        logError("Failed to fetch drinks with BAC", { partyId, error: error.message });
        throw new Error(`Database error: ${error.message}`);
      }

      // Transform to DTOs
      const drinksWithBAC: DrinkWithBACDTO[] = (data || []).map((drink) => {
        const bacData =
          Array.isArray(drink.baccalculations) && drink.baccalculations.length > 0
            ? drink.baccalculations[0]
            : !Array.isArray(drink.baccalculations)
              ? drink.baccalculations
              : null;

        const drinkDTO: DrinkDTO = {
          id: drink.id,
          party_id: drink.party_id,
          user_id: drink.user_id,
          volume_ml: drink.volume_ml,
          abv_percent: drink.abv_percent,
          consumed_at: drink.consumed_at,
          order_sequence: drink.order_sequence,
          edit_count: drink.edit_count ?? null,
          edited_at: drink.edited_at ?? null,
          original_values: drink.original_values ?? null,
          created_at: drink.created_at ?? new Date().toISOString(),
          updated_at: drink.updated_at ?? new Date().toISOString(),
        };

        let bacCalculationDTO: BACCalculationDTO | null = null;

        if (bacData) {
          // Parse profile snapshot
          const profileSnapshot = bacData.user_profile_snapshot as unknown as Json;
          const parsedSnapshot: ProfileSnapshot = {
            height_cm: (profileSnapshot as { height_cm: number }).height_cm,
            weight_kg: (profileSnapshot as { weight_kg: number }).weight_kg,
            gender: (profileSnapshot as { gender: "M" | "F" }).gender,
            captured_at: (profileSnapshot as { captured_at: string }).captured_at,
          };

          bacCalculationDTO = {
            id: bacData.id,
            drink_id: bacData.drink_id,
            party_id: bacData.party_id,
            user_id: bacData.user_id,
            calculated_bac: bacData.calculated_bac,
            time_since_first_drink_minutes: bacData.time_since_first_drink_minutes,
            algorithm_version: bacData.algorithm_version,
            metabolized_alcohol_g: bacData.metabolized_alcohol_g,
            user_profile_snapshot: parsedSnapshot,
            calculation_timestamp: bacData.calculation_timestamp ?? new Date().toISOString(),
            created_at: bacData.created_at ?? new Date().toISOString(),
          };
        }

        return {
          ...drinkDTO,
          bac_calculation: bacCalculationDTO,
        };
      });

      logInfo("Successfully fetched drinks with BAC", {
        partyId,
        count: drinksWithBAC.length,
      });

      return {
        party_id: partyId,
        drinks: drinksWithBAC,
        total_count: drinksWithBAC.length,
      };
    } else {
      // Fetch drinks without BAC calculations
      const { data, error } = await supabase
        .from("drinks")
        .select("*")
        .eq("party_id", partyId)
        .order("consumed_at", { ascending: true });

      if (error) {
        logError("Failed to fetch drinks", { partyId, error: error.message });
        throw new Error(`Database error: ${error.message}`);
      }

      // Transform to DTOs without BAC
      const drinksWithBAC: DrinkWithBACDTO[] = (data || []).map((drink) => {
        const drinkDTO: DrinkDTO = {
          id: drink.id,
          party_id: drink.party_id,
          user_id: drink.user_id,
          volume_ml: drink.volume_ml,
          abv_percent: drink.abv_percent,
          consumed_at: drink.consumed_at,
          order_sequence: drink.order_sequence,
          edit_count: drink.edit_count ?? null,
          edited_at: drink.edited_at ?? null,
          original_values: drink.original_values ?? null,
          created_at: drink.created_at ?? new Date().toISOString(),
          updated_at: drink.updated_at ?? new Date().toISOString(),
        };

        return {
          ...drinkDTO,
          bac_calculation: null,
        };
      });

      logInfo("Successfully fetched drinks without BAC", {
        partyId,
        count: drinksWithBAC.length,
      });

      return {
        party_id: partyId,
        drinks: drinksWithBAC,
        total_count: drinksWithBAC.length,
      };
    }
  } catch (error) {
    logError("Error in getDrinksByPartyId", {
      partyId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
