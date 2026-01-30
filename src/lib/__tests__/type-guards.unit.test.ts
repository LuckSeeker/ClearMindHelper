import { describe, it, expect } from "vitest";
import { parseProfileSnapshot, profileSnapshotToJson } from "../type-guards";
import type { ProfileSnapshot } from "../../types";

// Przykładowy poprawny snapshot
const validSnapshot: ProfileSnapshot = {
  height_cm: 180,
  weight_kg: 80,
  gender: "M",
  captured_at: "2026-01-30T12:00:00.000Z",
};

describe("parseProfileSnapshot", () => {
  it("poprawnie parsuje poprawny snapshot", () => {
    expect(parseProfileSnapshot(validSnapshot)).toEqual(validSnapshot);
  });

  it("rzuca błąd przy braku height_cm", () => {
    const invalid = { ...validSnapshot, height_cm: undefined };
    expect(() => parseProfileSnapshot(invalid)).toThrow("INVALID_PROFILE_SNAPSHOT");
  });

  it("rzuca błąd przy braku weight_kg", () => {
    const invalid = { ...validSnapshot, weight_kg: undefined };
    expect(() => parseProfileSnapshot(invalid)).toThrow("INVALID_PROFILE_SNAPSHOT");
  });

  it("rzuca błąd przy braku gender", () => {
    const invalid = { ...validSnapshot, gender: undefined };
    expect(() => parseProfileSnapshot(invalid)).toThrow("INVALID_PROFILE_SNAPSHOT");
  });

  it("rzuca błąd przy braku captured_at", () => {
    const invalid = { ...validSnapshot, captured_at: undefined };
    expect(() => parseProfileSnapshot(invalid)).toThrow("INVALID_PROFILE_SNAPSHOT");
  });
});

describe("profileSnapshotToJson", () => {
  it("konwertuje poprawny snapshot do Json", () => {
    const json = profileSnapshotToJson(validSnapshot);
    expect(json).toEqual({
      height_cm: 180,
      weight_kg: 80,
      gender: "M",
      captured_at: "2026-01-30T12:00:00.000Z",
    });
  });

  it("zachowuje typy i wartości pól", () => {
    const snapshot: ProfileSnapshot = {
      height_cm: 165,
      weight_kg: 60,
      gender: "F",
      captured_at: "2026-01-30T13:00:00.000Z",
    };
    const json = profileSnapshotToJson(snapshot);
    expect(json).toEqual({
      height_cm: 165,
      weight_kg: 60,
      gender: "F",
      captured_at: "2026-01-30T13:00:00.000Z",
    });
  });
});
