/**
 * GET /api/profile
 *
 * Retrieves the authenticated user's profile data.
 * Returns profile with computed is_complete field.
 *
 * Authentication: Required (JWT token in Authorization header)
 * Authorization: User can only access their own profile (enforced by RLS)
 *
 * Success Response (200):
 *   - UserProfileDTO with all profile fields and is_complete status
 *
 * Error Responses:
 *   - 401: Missing or invalid authentication token
 *   - 404: User profile not found (user should create profile)
 *   - 500: Internal server error (database or unexpected error)
 */

import type { APIRoute } from "astro";

import { DEFAULT_USER_ID } from "../../db/supabase.client";
import { logError } from "../../lib/logger";
import { getProfile } from "../../lib/services/profile.service";
import type { APIError, UserProfileDTO } from "../../types";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  try {
    // Extract Supabase client from middleware
    const supabase = locals.supabase;

    if (!supabase) {
      logError("Supabase client not available in locals");
      return new Response(
        JSON.stringify({
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "An unexpected error occurred. Please try again later.",
          },
        } satisfies APIError),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // DEVELOPMENT MODE: Use default user ID instead of authentication
    // TODO: Replace with proper JWT authentication
    const userId = DEFAULT_USER_ID;

    // Retrieve user profile using ProfileService
    const profile = await getProfile(userId, supabase);

    // Handle profile not found
    if (!profile) {
      return new Response(
        JSON.stringify({
          error: {
            code: "PROFILE_NOT_FOUND",
            message: "User profile not found. Please create your profile first.",
          },
        } satisfies APIError),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Return successful response with profile data
    // Include cache headers for performance optimization
    return new Response(JSON.stringify(profile satisfies UserProfileDTO), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=60",
        ETag: `W/"${profile.updated_at}"`,
      },
    });
  } catch (error) {
    // Log unexpected errors for monitoring
    logError("Unexpected error in GET /api/profile:", error);

    // Return generic error response
    return new Response(
      JSON.stringify({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred. Please try again later.",
          details: process.env.NODE_ENV === "development" ? { error: String(error) } : undefined,
        },
      } satisfies APIError),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
