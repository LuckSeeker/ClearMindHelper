import { describe, it, expect } from "vitest";
import { UpdateProfileSchema } from "../lib/validation/profile.validation";

// Test cases for UpdateProfileSchema

describe("UpdateProfileSchema", () => {
  it("prawidłowe dane przechodzą walidację", () => {
    const valid = {
      height_cm: 180,
      weight_kg: 80,
      gender: "M",
    };
    expect(() => UpdateProfileSchema.parse(valid)).not.toThrow();
  });

  it("odrzuca zbyt niski wzrost", () => {
    const data = { height_cm: 40, weight_kg: 80, gender: "M" };
    expect(() => UpdateProfileSchema.parse(data)).toThrow("Height must be at least 50 cm");
  });

  it("odrzuca zbyt wysoki wzrost", () => {
    const data = { height_cm: 300, weight_kg: 80, gender: "M" };
    expect(() => UpdateProfileSchema.parse(data)).toThrow("Height must be at most 250 cm");
  });

  it("odrzuca niecałkowity wzrost", () => {
    const data = { height_cm: 180.5, weight_kg: 80, gender: "M" };
    expect(() => UpdateProfileSchema.parse(data)).toThrow("Height must be an integer");
  });

  it("odrzuca zbyt niską wagę", () => {
    const data = { height_cm: 180, weight_kg: 20, gender: "M" };
    expect(() => UpdateProfileSchema.parse(data)).toThrow("Weight must be at least 30 kg");
  });

  it("odrzuca zbyt wysoką wagę", () => {
    const data = { height_cm: 180, weight_kg: 400, gender: "M" };
    expect(() => UpdateProfileSchema.parse(data)).toThrow("Weight must be at most 300 kg");
  });

  it("odrzuca nieprawidłową płeć", () => {
    const data = { height_cm: 180, weight_kg: 80, gender: "X" };
    expect(() => UpdateProfileSchema.parse(data)).toThrow("Invalid enum value. Expected 'M' | 'F', received 'X'");
  });

  it("odrzuca brakujące pole height_cm", () => {
    const data = { weight_kg: 80, gender: "M" };
    expect(() => UpdateProfileSchema.parse(data)).toThrow("Height is required");
  });

  it("odrzuca brakujące pole weight_kg", () => {
    const data = { height_cm: 180, gender: "M" };
    expect(() => UpdateProfileSchema.parse(data)).toThrow("Weight is required");
  });

  it("odrzuca brakujące pole gender", () => {
    const data = { height_cm: 180, weight_kg: 80 };
    expect(() => UpdateProfileSchema.parse(data)).toThrow("Gender is required");
  });
});
