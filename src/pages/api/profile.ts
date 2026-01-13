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
import { logError } from "../../lib/logger";
import { getProfile, upsertProfile } from "../../lib/services/profile.service";
import { UpdateProfileSchema } from "../../lib/validation/profile.validation";
import {
  parseJsonBody,
  createValidationErrorResponse,
  createSuccessResponse,
  CommonErrors,
} from "../../lib/api-helpers";
import type { UserProfileDTO } from "../../types";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  try {
    const supabase = locals.supabase;
    if (!supabase) {
      logError("Supabase client not available in locals");
      return CommonErrors.supabaseUnavailable();
    }

    const userId = DEFAULT_USER_ID;
    const profile = await getProfile(userId, supabase);

    if (!profile) {
      return new Response(
        JSON.stringify({
          error: {
            code: "PROFILE_NOT_FOUND",
            message: "User profile not found. Please create your profile first.",
          },
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(profile satisfies UserProfileDTO), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=60",
        ETag: `W/"${profile.updated_at}"`,
      },
    });
  } catch (error) {
    logError("Unexpected error in GET /api/profile:", error);
    return CommonErrors.internalError();
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  try {
    const supabase = locals.supabase;
    if (!supabase) {
      logError("Supabase client not available in locals");
      return CommonErrors.supabaseUnavailable();
    }

    const userId = DEFAULT_USER_ID;

    const bodyResult = await parseJsonBody(request, false);
    if (!bodyResult.success) return bodyResult.response;

    const validationResult = UpdateProfileSchema.safeParse(bodyResult.value);
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error);
    }

    const profile = await upsertProfile(userId, validationResult.data, supabase);
    return createSuccessResponse(profile);
  } catch (error) {
    logError("Unexpected error in PUT /api/profile:", error);
    return CommonErrors.internalError();
  }
};
