/**
 * Profile Service
 *
 * Handles business logic for user profile operations including:
 * - Retrieving user profiles
 * - Computing profile completeness
 * - Formatting timestamps
 */

import type { SupabaseClient } from "../../db/supabase.client";
import type { UserProfileDTO } from "../../types";

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
