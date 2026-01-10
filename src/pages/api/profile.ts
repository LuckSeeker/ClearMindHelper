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
 *
 * PUT /api/profile
 *
 * Creates or updates the authenticated user's profile (upsert operation).
 * Returns updated profile with computed is_complete field.
 *
 * Authentication: Required (JWT token in Authorization header)
 * Authorization: User can only update their own profile (enforced by user_id from session)
 *
 * Request Body:
 *   - height_cm: number (50-250)
 *   - weight_kg: number (30-300, max 2 decimal places)
 *   - gender: "M" | "F"
 *
 * Success Response (200):
 *   - UserProfileDTO with all profile fields and is_complete status
 *
 * Error Responses:
 *   - 400: Invalid request body or validation failed
 *   - 401: Missing or invalid authentication token
 *   - 500: Internal server error (database or unexpected error)
 */

import type { APIRoute } from "astro";

import { DEFAULT_USER_ID } from "../../db/supabase.client";
import { logError, logWarning } from "../../lib/logger";
import { getProfile, upsertProfile } from "../../lib/services/profile.service";
import { UpdateProfileSchema } from "../../lib/validation/profile.validation";
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

export const PUT: APIRoute = async ({ request, locals }) => {
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

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      logWarning("Invalid JSON in request body", { error: String(error) });
      return new Response(
        JSON.stringify({
          error: {
            code: "INVALID_JSON",
            message: "Request body must be valid JSON",
          },
        } satisfies APIError),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate request body against schema
    const validationResult = UpdateProfileSchema.safeParse(body);
    if (!validationResult.success) {
      const formattedErrors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
        code: err.code,
      }));

      logWarning("Validation failed for PUT /api/profile", { userId, errors: formattedErrors });

      return new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_FAILED",
            message: "Validation failed",
            details: { errors: formattedErrors },
          },
        } satisfies APIError),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Call service to upsert profile
    const profile = await upsertProfile(userId, validationResult.data, supabase);

    // Return successful response with profile data
    return new Response(JSON.stringify(profile satisfies UserProfileDTO), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    // Log unexpected errors for monitoring
    logError("Unexpected error in PUT /api/profile:", error);

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
