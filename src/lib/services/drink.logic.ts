// Czysto funkcyjne helpery do testów i logiki BAC
import type { ProfileSnapshot, Drink, DrinkValidationWarning } from "../../types";
import { ERROR_CODES, WIDMARK_CONSTANTS } from "../constants";
export const CONSUMED_AT_TOLERANCE_MS = WIDMARK_CONSTANTS.CONSUMED_AT_TOLERANCE_MS;

export function validatePartyForDrink(party: { status: string }) {
  if (party.status !== "ongoing") {
    return {
      valid: false,
      error: {
        code: ERROR_CODES.PARTY_ALREADY_CLOSED,
        message: "Cannot add drinks to a closed party",
      },
      status: 400,
    };
  }
  return { valid: true };
}

export function validateConsumedAtInPartyTimeframe(
  consumedAt: Date,
  party: { started_at: string; ended_at: string | null }
) {
  const startedAt = new Date(party.started_at);
  const endedAt = party.ended_at ? new Date(party.ended_at) : null;
  const toleranceMs = CONSUMED_AT_TOLERANCE_MS;
  if (consumedAt.getTime() < startedAt.getTime() - toleranceMs) {
    return {
      valid: false,
      error: {
        code: ERROR_CODES.CONSUMED_AT_BEFORE_PARTY_START,
        message: `consumed_at cannot be more than 5 minutes before party start time`,
      },
    };
  }
  if (endedAt && consumedAt > endedAt) {
    return {
      valid: false,
      error: {
        code: ERROR_CODES.CONSUMED_AT_AFTER_PARTY_END,
        message: "consumed_at cannot be after party end time",
      },
    };
  }
  const now = new Date();
  if (consumedAt.getTime() > now.getTime() + toleranceMs) {
    return {
      valid: false,
      error: {
        code: ERROR_CODES.CONSUMED_AT_IN_FUTURE,
        message: `consumed_at cannot be more than 5 minutes in the future`,
      },
    };
  }
  return { valid: true };
}

export function checkUnrealisticVolume(volumeMl: number): DrinkValidationWarning | null {
  if (volumeMl > WIDMARK_CONSTANTS.UNREALISTIC_VOLUME_THRESHOLD) {
    return {
      code: ERROR_CODES.UNREALISTIC_VOLUME,
      message: `Volume of ${volumeMl}ml is unusually large. Are you sure this is correct?`,
      field: "volume_ml",
      value: volumeMl,
    };
  }
  return null;
}

export function checkFastConsumption(consumedAt: Date, lastDrink: Drink | null): DrinkValidationWarning | null {
  if (!lastDrink) return null;
  const lastConsumedAt = new Date(lastDrink.consumed_at);
  const timeDiffMinutes = (consumedAt.getTime() - lastConsumedAt.getTime()) / (1000 * 60);
  if (timeDiffMinutes < WIDMARK_CONSTANTS.FAST_CONSUMPTION_THRESHOLD_MINUTES) {
    return {
      code: ERROR_CODES.FAST_CONSUMPTION,
      message: `Only ${Math.round(timeDiffMinutes)} minutes since last drink. Consider slowing down.`,
      field: "consumed_at",
      value: timeDiffMinutes,
    };
  }
  return null;
}

export function validateBACLimit(
  volumeMl: number,
  abvPercent: number,
  currentTotalAlcohol: number,
  profileSnapshot: ProfileSnapshot
) {
  const newAlcoholGrams = calculateAlcoholGrams(volumeMl, abvPercent);
  const totalWithNewDrink = currentTotalAlcohol + newAlcoholGrams;
  const bodyWeightGrams = profileSnapshot.weight_kg * 1000;
  const widmarkR = profileSnapshot.gender === "M" ? WIDMARK_CONSTANTS.MALE_R : WIDMARK_CONSTANTS.FEMALE_R;
  const projectedBAC = (totalWithNewDrink / (bodyWeightGrams * widmarkR)) * 1000;
  if (projectedBAC > WIDMARK_CONSTANTS.MAX_BAC_LIMIT) {
    return {
      valid: false,
      error: {
        code: ERROR_CODES.BAC_LIMIT_EXCEEDED,
        message: `This drink would result in BAC of ${projectedBAC.toFixed(2)}‰, which exceeds the maximum allowed value of ${WIDMARK_CONSTANTS.MAX_BAC_LIMIT}‰. Please reduce volume or ABV.`,
      },
    };
  }
  return { valid: true };
}

export function calculateAlcoholGrams(volumeMl: number, abvPercent: number): number {
  return (volumeMl * abvPercent * WIDMARK_CONSTANTS.ETHANOL_DENSITY) / 100;
}

export function calculateBACAccurate(
  drinks: { volume_ml: number; abv_percent: number; consumed_at: string }[],
  profileSnapshot: ProfileSnapshot,
  now: Date,
  metabolizationRate: number = WIDMARK_CONSTANTS.DEFAULT_METABOLIZATION_RATE
): number {
  const bodyWeightGrams = profileSnapshot.weight_kg * 1000;
  const widmarkR = profileSnapshot.gender === "M" ? WIDMARK_CONSTANTS.MALE_R : WIDMARK_CONSTANTS.FEMALE_R;
  let totalRemainingAlcohol = 0;
  for (const drink of drinks) {
    const alcoholGrams = calculateAlcoholGrams(drink.volume_ml, drink.abv_percent);
    const consumedAt = new Date(drink.consumed_at);
    const hoursElapsed = (now.getTime() - consumedAt.getTime()) / (1000 * 60 * 60);
    const metabolized = Math.max(0, hoursElapsed) * metabolizationRate;
    const remaining = Math.max(0, alcoholGrams - metabolized);
    totalRemainingAlcohol += remaining;
  }
  const bac = (totalRemainingAlcohol / (bodyWeightGrams * widmarkR)) * 1000;
  return Math.max(0, bac);
}
