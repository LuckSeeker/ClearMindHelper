import { describe, it, expect } from "vitest";
import {
  calculateAlcoholGrams,
  calculateBACAccurate,
  checkUnrealisticVolume,
  checkFastConsumption,
  validateBACLimit,
  validateConsumedAtInPartyTimeframe,
  validatePartyForDrink,
} from "../lib/services/drink.logic";
import type { ProfileSnapshot, Drink } from "../types";

const PROFILE_MALE = { height_cm: 180, weight_kg: 80, gender: "M" as const, captured_at: "2026-01-01T12:00:00Z" };
const PROFILE_FEMALE = { height_cm: 165, weight_kg: 60, gender: "F" as const, captured_at: "2026-01-01T12:00:00Z" };

// Helper for date math
const now = new Date("2026-01-29T12:00:00Z");

// TC_BAC_001: Standard male, 1 beer 500ml 5%
describe("calculateBACAccurate", () => {
  it("TC_BAC_001: BAC for 80kg male, 500ml 5% beer", () => {
    const drinks = [{ volume_ml: 500, abv_percent: 5, consumed_at: now.toISOString() }];
    const bac = calculateBACAccurate(drinks, PROFILE_MALE, now);
    // Widmark: (500*5*0.789/100) / (80000*0.68) * 1000
    const expected = ((500 * 5 * 0.789) / 100 / (80000 * 0.68)) * 1000;
    expect(bac).toBeCloseTo(expected, 4);
  });

  it("TC_BAC_002: BAC for 60kg female, 150ml 12% wine", () => {
    const drinks = [{ volume_ml: 150, abv_percent: 12, consumed_at: now.toISOString() }];
    const bac = calculateBACAccurate(drinks, PROFILE_FEMALE, now);
    const expected = ((150 * 12 * 0.789) / 100 / (60000 * 0.55)) * 1000;
    expect(bac).toBeCloseTo(expected, 4);
  });

  it("TC_BAC_003: BAC drops after 3h (metabolized)", () => {
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const drinks = [{ volume_ml: 500, abv_percent: 5, consumed_at: threeHoursAgo.toISOString() }];
    const bac = calculateBACAccurate(drinks, PROFILE_MALE, now);
    // Metabolized: 3h * 7.5g/h = 22.5g
    const alcohol = calculateAlcoholGrams(500, 5);
    const remaining = Math.max(0, alcohol - 22.5);
    const expected = (remaining / (80000 * 0.68)) * 1000;
    expect(bac).toBeCloseTo(expected, 4);
  });

  it("TC_BAC_005: BAC for drink consumed 1h ago", () => {
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const drinks = [{ volume_ml: 500, abv_percent: 5, consumed_at: oneHourAgo.toISOString() }];
    const bac = calculateBACAccurate(drinks, PROFILE_MALE, now);
    const alcohol = calculateAlcoholGrams(500, 5);
    const remaining = Math.max(0, alcohol - 7.5);
    const expected = (remaining / (80000 * 0.68)) * 1000;
    expect(bac).toBeCloseTo(expected, 4);
  });
});

describe("checkUnrealisticVolume", () => {
  it("TC_DRINK_001: Warns for >2000ml", () => {
    const warning = checkUnrealisticVolume(2500);
    expect(warning).not.toBeNull();
    expect(warning?.code).toBeDefined();
  });
  it("Does not warn for 500ml", () => {
    expect(checkUnrealisticVolume(500)).toBeNull();
  });
});

describe("checkFastConsumption", () => {
  it("Warns if less than 15min since last drink", () => {
    const now = new Date();
    const lastDrink: Partial<Drink> = { consumed_at: new Date(now.getTime() - 5 * 60 * 1000).toISOString() };
    const warning = checkFastConsumption(now, lastDrink as Drink);
    expect(warning).not.toBeNull();
    expect(warning?.code).toBeDefined();
  });
  it("No warning if >15min", () => {
    const now = new Date();
    const lastDrink: Partial<Drink> = { consumed_at: new Date(now.getTime() - 20 * 60 * 1000).toISOString() };
    expect(checkFastConsumption(now, lastDrink as Drink)).toBeNull();
  });
});

describe("validateBACLimit", () => {
  it("Blocks drink if BAC would exceed 5.0‰", () => {
    // Profile: 50kg, 1L 96% spirytus
    const profile: ProfileSnapshot = { ...PROFILE_MALE, weight_kg: 50 };
    const result = validateBACLimit(1000, 96, 0, profile);
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBeDefined();
  });
  it("Allows drink if BAC below limit", () => {
    const result = validateBACLimit(500, 5, 0, PROFILE_MALE);
    expect(result.valid).toBe(true);
  });
});

describe("validateConsumedAtInPartyTimeframe", () => {
  const party = {
    started_at: "2026-01-29T10:00:00Z",
    ended_at: "2026-01-29T18:00:00Z",
  };
  it("Rejects drink before party start -5min tolerance", () => {
    const consumedAt = new Date("2026-01-29T09:54:00Z");
    const result = validateConsumedAtInPartyTimeframe(consumedAt, party);
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBeDefined();
  });
  it("Allows drink within party timeframe", () => {
    const consumedAt = new Date("2026-01-29T12:00:00Z");
    expect(validateConsumedAtInPartyTimeframe(consumedAt, party).valid).toBe(true);
  });
  it("Rejects drink after party end", () => {
    const consumedAt = new Date("2026-01-29T19:00:00Z");
    const result = validateConsumedAtInPartyTimeframe(consumedAt, party);
    expect(result.valid).toBe(false);
  });
});

describe("validatePartyForDrink", () => {
  it("Rejects if party is closed", () => {
    const result = validatePartyForDrink({ status: "closed" });
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBeDefined();
  });
  it("Allows if party is ongoing", () => {
    expect(validatePartyForDrink({ status: "ongoing" }).valid).toBe(true);
  });
});
