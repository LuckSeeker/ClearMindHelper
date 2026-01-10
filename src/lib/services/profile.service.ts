/**
 * Profile Service
 *
 * Handles business logic for user profile operations including:
 * - Retrieving user profiles
 * - Creating and updating user profiles (upsert)
 * - Computing profile completeness
 * - Formatting timestamps
 */

import type { SupabaseClient } from "../../db/supabase.client";
import type { UpdateUserProfileCommand, UserProfileDTO } from "../../types";
import { logError, logInfo } from "../logger";

/**
 * Retrieves user profile by user ID
 *
 * @param userId - The authenticated user's UUID
 * @param supabase - Supabase client instance
 * @returns UserProfileDTO with computed is_complete field
 * @throws Error if database query fails
 */
export async function getProfile(userId: string, supabase: SupabaseClient): Promise<UserProfileDTO | null> {
  // Query user profile from database
  // RLS policies ensure user can only access their own profile
  const { data: profile, error } = await supabase.from("userprofiles").select("*").eq("user_id", userId).single();

  // Handle database errors
  if (error) {
    // PGRST116 is "not found" error code in PostgREST
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Database error: ${error.message}`);
  }

  // Return null if profile doesn't exist
  if (!profile) {
    return null;
  }

  // Compute is_complete field
  // Profile is complete when all required fields are filled
  const isComplete = profile.height_cm !== null && profile.weight_kg !== null && profile.gender !== null;

  // Format timestamps to ISO 8601 strings
  // created_at and updated_at have DEFAULT in schema so should always exist
  const profileDTO: UserProfileDTO = {
    id: profile.id,
    user_id: profile.user_id,
    height_cm: profile.height_cm,
    weight_kg: profile.weight_kg,
    gender: profile.gender,
    created_at: profile.created_at ? new Date(profile.created_at).toISOString() : new Date().toISOString(),
    updated_at: profile.updated_at ? new Date(profile.updated_at).toISOString() : new Date().toISOString(),
    is_complete: isComplete,
  };

  return profileDTO;
}

/**
 * Creates or updates user profile (upsert operation)
 *
 * @param userId - The authenticated user's UUID
 * @param command - Profile data to create/update
 * @param supabase - Supabase client instance
 * @returns UserProfileDTO with computed is_complete field
 * @throws Error if database query fails
 */
export async function upsertProfile(
  userId: string,
  command: UpdateUserProfileCommand,
  supabase: SupabaseClient
): Promise<UserProfileDTO> {
  logInfo("Upserting profile", { userId });

  // Perform upsert operation
  // If profile exists (matching user_id), it will be updated
  // If profile doesn't exist, it will be created
  // on_conflict: user_id ensures we update the correct profile
  const { data: profile, error } = await supabase
    .from("userprofiles")
    .upsert(
      {
        user_id: userId,
        height_cm: command.height_cm,
        weight_kg: command.weight_kg,
        gender: command.gender,
        // updated_at is automatically set by database trigger
      },
      {
        onConflict: "user_id",
      }
    )
    .select()
    .single();

  // Handle database errors
  if (error) {
    logError("Failed to upsert user profile", { userId, error: error.message });
    throw new Error(`Database error: ${error.message}`);
  }

  // This should never happen, but handle it just in case
  if (!profile) {
    logError("Upsert returned no data", { userId });
    throw new Error("Failed to upsert profile: no data returned");
  }

  logInfo("Profile upserted successfully", { userId, profileId: profile.id });

  // Compute is_complete field
  // Profile is complete when all required fields are filled
  const isComplete = profile.height_cm !== null && profile.weight_kg !== null && profile.gender !== null;

  // Format timestamps to ISO 8601 strings
  const profileDTO: UserProfileDTO = {
    id: profile.id,
    user_id: profile.user_id,
    height_cm: profile.height_cm,
    weight_kg: profile.weight_kg,
    gender: profile.gender,
    created_at: profile.created_at ? new Date(profile.created_at).toISOString() : new Date().toISOString(),
    updated_at: profile.updated_at ? new Date(profile.updated_at).toISOString() : new Date().toISOString(),
    is_complete: isComplete,
  };

  return profileDTO;
}
