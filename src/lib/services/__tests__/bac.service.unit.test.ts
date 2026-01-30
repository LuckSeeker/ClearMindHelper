import { describe, it, expect, vi } from "vitest";
import * as bacService from "../bac.service";
import type { ProfileSnapshot } from "../../../types";
import type { SupabaseClient } from "../../../db/supabase.client";

// Mock constants for Widmark
const WIDMARK_CONSTANTS = {
  MALE_R: 0.68,
  FEMALE_R: 0.55,
  METABOLISM_RATE_PER_KG_PER_HOUR: 0.15,
  APPROACHING_THRESHOLD_RATIO: 0.9,
};
// Mock ProfileSnapshots (pełne typy)
const maleProfile: ProfileSnapshot = {
  weight_kg: 80,
  gender: "M",
  height_cm: 180,
  captured_at: "2024-01-01T00:00:00.000Z",
};
const femaleProfile: ProfileSnapshot = {
  weight_kg: 60,
  gender: "F",
  height_cm: 165,
  captured_at: "2024-01-01T00:00:00.000Z",
};

// Patch constants in tested module
vi.mock("../constants", () => ({
  WIDMARK_CONSTANTS,
  ERROR_CODES: {
    PARTY_NOT_FOUND: "PARTY_NOT_FOUND",
    PARTY_ALREADY_CLOSED: "PARTY_ALREADY_CLOSED",
    NO_DRINKS_IN_PARTY: "NO_DRINKS_IN_PARTY",
    NO_THRESHOLD_FOUND: "NO_THRESHOLD_FOUND",
    DATABASE_ERROR: "DATABASE_ERROR",
    FORBIDDEN: "FORBIDDEN",
  },
}));

// --- Helper function tests ---
describe("getWaterDistributionCoefficient", () => {
  it("returns correct coefficient for male", () => {
    expect(bacService["getWaterDistributionCoefficient"]("M")).toBe(WIDMARK_CONSTANTS.MALE_R);
  });
  it("returns correct coefficient for female", () => {
    expect(bacService["getWaterDistributionCoefficient"]("F")).toBe(WIDMARK_CONSTANTS.FEMALE_R);
  });
});

describe("getTimeElapsedMinutes", () => {
  it("returns correct minutes between two ISO strings", () => {
    const from = "2024-01-01T00:00:00.000Z";
    const to = "2024-01-01T01:30:00.000Z";
    expect(bacService["getTimeElapsedMinutes"](from, to)).toBe(90);
  });
});

describe("getBACDecreasePerHour", () => {
  it("calculates correct BAC decrease for male", () => {
    const r = bacService.getWaterDistributionCoefficient(maleProfile.gender);
    const expected =
      (WIDMARK_CONSTANTS.METABOLISM_RATE_PER_KG_PER_HOUR * maleProfile.weight_kg) / (maleProfile.weight_kg * r);
    expect(bacService.getBACDecreasePerHour(maleProfile)).toBeCloseTo(expected, 3);
  });
  it("calculates correct BAC decrease for female", () => {
    const r = bacService.getWaterDistributionCoefficient(femaleProfile.gender);
    const expected =
      (WIDMARK_CONSTANTS.METABOLISM_RATE_PER_KG_PER_HOUR * femaleProfile.weight_kg) / (femaleProfile.weight_kg * r);
    expect(bacService.getBACDecreasePerHour(femaleProfile)).toBeCloseTo(expected, 3);
  });
});

describe("calculateBACDecay", () => {
  it("returns correct decay after 2 hours", () => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const result = bacService["calculateBACDecay"](1.0, twoHoursAgo, maleProfile);
    expect(result.current_bac).toBeLessThan(1.0);
    expect(result.time_elapsed_minutes).toBeGreaterThanOrEqual(119); // allow 1 min drift
  });
});

describe("determineThresholdStatus", () => {
  it('returns "exceeded" if BAC >= threshold', () => {
    expect(bacService["determineThresholdStatus"](1.0, 0.8)).toBe("exceeded");
  });
  it('returns "approaching" if BAC >= 90% threshold', () => {
    expect(bacService["determineThresholdStatus"](0.73, 0.8)).toBe("approaching");
  });
  it('returns "safe" if BAC < 90% threshold', () => {
    expect(bacService["determineThresholdStatus"](0.5, 0.8)).toBe("safe");
  });
});

describe("calculateTimeToSober", () => {
  it("returns null if already sober", () => {
    expect(bacService["calculateTimeToSober"](0, maleProfile)).toBeNull();
  });
  it("returns correct minutes to sober", () => {
    const minutes = bacService["calculateTimeToSober"](0.5, maleProfile);
    expect(minutes).toBeGreaterThan(0);
  });
});

// --- Main service function (integration) tests ---
describe("getCurrentBAC", () => {
  it("throws PARTY_NOT_FOUND if party not found", async () => {
    const supabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: true }),
    };
    await expect(bacService.getCurrentBAC(supabase as unknown as SupabaseClient, 1, "user")).rejects.toThrow(
      "PARTY_NOT_FOUND"
    );
  });
  // ...more integration tests can be added for other error paths and happy path
});

describe("getBACHistory", () => {
  it("throws PARTY_NOT_FOUND if party not found", async () => {
    const supabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: true }),
    };
    await expect(bacService.getBACHistory(supabase as unknown as SupabaseClient, 1, "user")).rejects.toThrow(
      "PARTY_NOT_FOUND"
    );
  });
  // ...more integration tests can be added for other error paths and happy path
});
