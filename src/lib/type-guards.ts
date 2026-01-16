/**
 * Type guards and parsing utilities
 *
 * Provides safe type conversion with runtime validation
 */

import type { ProfileSnapshot } from "../types";
import type { Json } from "../db/database.types";

/**
 * Parse and validate ProfileSnapshot from database JSON
 *
 * @param data - JSON data from database
 * @returns Validated ProfileSnapshot
 * @throws Error if snapshot data is invalid or missing required fields
 */
export function parseProfileSnapshot(data: unknown): ProfileSnapshot {
  const snapshot = data as ProfileSnapshot;

  if (!snapshot?.height_cm || !snapshot?.weight_kg || !snapshot?.gender || !snapshot?.captured_at) {
    throw new Error("INVALID_PROFILE_SNAPSHOT");
  }

  return snapshot;
}

/**
 * Convert ProfileSnapshot to Json for database storage
 *
 * @param snapshot - ProfileSnapshot to convert
 * @returns Json object safe for database storage
 */
export function profileSnapshotToJson(snapshot: ProfileSnapshot): Json {
  // Strukturalne kopiowanie do zgodności z Json type
  return {
    height_cm: snapshot.height_cm,
    weight_kg: snapshot.weight_kg,
    gender: snapshot.gender,
    captured_at: snapshot.captured_at,
  };
}
