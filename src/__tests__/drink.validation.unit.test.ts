import { describe, it, expect } from "vitest";
import { AddDrinkSchema, UpdateDrinkSchema, PartyDrinksQueryParamsSchema } from "../lib/validation/drink.validation";

describe("PartyDrinksQueryParamsSchema", () => {
  it("should accept boolean true/false", () => {
    expect(PartyDrinksQueryParamsSchema.parse({ include_bac: true }).include_bac).toBe(true);
    expect(PartyDrinksQueryParamsSchema.parse({ include_bac: false }).include_bac).toBe(false);
  });

  it("should accept string representations of true", () => {
    expect(PartyDrinksQueryParamsSchema.parse({ include_bac: "true" }).include_bac).toBe(true);
    expect(PartyDrinksQueryParamsSchema.parse({ include_bac: "1" }).include_bac).toBe(true);
    expect(PartyDrinksQueryParamsSchema.parse({ include_bac: "yes" }).include_bac).toBe(true);
  });

  it("should accept string representations of false", () => {
    expect(PartyDrinksQueryParamsSchema.parse({ include_bac: "false" }).include_bac).toBe(false);
    expect(PartyDrinksQueryParamsSchema.parse({ include_bac: "0" }).include_bac).toBe(false);
    expect(PartyDrinksQueryParamsSchema.parse({ include_bac: "no" }).include_bac).toBe(false);
  });

  it("should default to true if not provided", () => {
    expect(PartyDrinksQueryParamsSchema.parse({}).include_bac).toBe(true);
  });
});

describe("AddDrinkSchema", () => {
  it("should validate correct input", () => {
    const input = {
      volume_ml: 500,
      abv_percent: 5,
      consumed_at: "2024-01-01T12:00:00.000Z",
      confirm_warnings: true,
    };
    expect(AddDrinkSchema.parse(input)).toMatchObject(input);
  });

  it("should fail for negative volume_ml", () => {
    expect(() => AddDrinkSchema.parse({ volume_ml: -100, abv_percent: 5 })).toThrow();
  });

  it("should fail for abv_percent > 100", () => {
    expect(() => AddDrinkSchema.parse({ volume_ml: 100, abv_percent: 120 })).toThrow();
  });

  it("should fail for abv_percent < 0", () => {
    expect(() => AddDrinkSchema.parse({ volume_ml: 100, abv_percent: -1 })).toThrow();
  });

  it("should fail for volume_ml > 5000", () => {
    expect(() => AddDrinkSchema.parse({ volume_ml: 6000, abv_percent: 5 })).toThrow();
  });

  it("should allow missing consumed_at and confirm_warnings", () => {
    const input = { volume_ml: 100, abv_percent: 5 };
    expect(AddDrinkSchema.parse(input)).toMatchObject({ volume_ml: 100, abv_percent: 5 });
  });
});

describe("UpdateDrinkSchema", () => {
  it("should validate correct input", () => {
    const input = {
      volume_ml: 200,
      abv_percent: 10,
      consumed_at: "2024-01-01T12:00:00.000Z",
    };
    expect(UpdateDrinkSchema.parse(input)).toMatchObject(input);
  });

  it("should fail for abv_percent > 100", () => {
    expect(() => UpdateDrinkSchema.parse({ volume_ml: 100, abv_percent: 120 })).toThrow();
  });

  it("should fail for abv_percent < 0", () => {
    expect(() => UpdateDrinkSchema.parse({ volume_ml: 100, abv_percent: -1 })).toThrow();
  });

  it("should fail for volume_ml > 5000", () => {
    expect(() => UpdateDrinkSchema.parse({ volume_ml: 6000, abv_percent: 5 })).toThrow();
  });

  it("should fail for negative volume_ml", () => {
    expect(() => UpdateDrinkSchema.parse({ volume_ml: -100, abv_percent: 5 })).toThrow();
  });

  it("should allow missing consumed_at", () => {
    const input = { volume_ml: 100, abv_percent: 5 };
    expect(UpdateDrinkSchema.parse(input)).toMatchObject({ volume_ml: 100, abv_percent: 5 });
  });
});
