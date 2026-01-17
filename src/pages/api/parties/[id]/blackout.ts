/**
 * API Endpoint: PATCH /api/parties/:id/blackout
 *
 * Marks a party as ended with blackout and automatically adjusts user's BAC threshold.
 * When a user experiences a blackout, the system creates a new threshold based on
 * the maximum BAC reached during that party to help prevent future incidents.
 *
 * Authentication: Required (JWT Bearer token)
 * Authorization: User must be the owner of the party
 *
 * Request:
 * - Path param: id (number) - Party ID
 * - Body: empty (no body required)
 *
 * Response 200:
 * {
 *   id: number,
 *   blackout_marked: boolean,
 *   blackout_marked_at: string | null,
 *   new_threshold: UserThresholdDTO | null
 * }
 *
 * Error responses:
 * - 400: Validation failed or party not closed or no BAC calculations
 * - 401: Unauthorized (no/invalid token)
 * - 403: Forbidden (not party owner)
 * - 404: Party not found
 * - 500: Internal server error
 */

import type { APIRoute } from "astro";
import { PartyIdParamSchema } from "../../../../lib/validation/party.validation";
import { markBlackout } from "../../../../lib/services/party.service";
import { logError, logInfo } from "../../../../lib/logger";
import { createErrorResponse } from "../../../../lib/api-helpers";
import { DEFAULT_USER_ID } from "../../../../db/supabase.client";
import { validateSupabaseClient } from "../../../../lib/api-helpers";

export const prerender = false;

/**
 * PATCH handler for marking blackout on a party
 *
 * Flow:
 * 1. Authenticate user via middleware
 * 2. Validate path parameter (party ID)
 * 3. Call service to mark blackout
 * 4. Return response with new threshold
 */
export const PATCH: APIRoute = async ({ params, locals }) => {
  // Step 1: Check Supabase client availability
  const supabaseResult = validateSupabaseClient(locals.supabase);
  if (!supabaseResult.success) return supabaseResult.response;
  const supabase = supabaseResult.value;

  // DEVELOPMENT MODE: Use default user ID instead of authentication
  // TODO: Replace with proper JWT authentication
  const userId = DEFAULT_USER_ID;
  try {
    // Step 2: Validate path parameter
    const paramsValidation = PartyIdParamSchema.safeParse(params);
    if (!paramsValidation.success) {
      const firstError = paramsValidation.error.errors[0];
      logError("Invalid party ID parameter", {
        userId,
        partyId: params.id,
        error: firstError.message,
      });
      return createErrorResponse(
        {
          code: "INVALID_PARTY_ID",
          message: firstError.message,
        },
        400,
        { field: firstError.path.join("."), value: params.id }
      );
    }

    const partyId = paramsValidation.data.id;

    // Step 3: Call service to mark blackout
    const response = await markBlackout(supabase, partyId, userId);

    logInfo("Blackout marked via API", {
      userId,
      partyId,
      newThreshold: response.new_threshold?.threshold_bac,
    });

    // Step 4: Return success response
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error: unknown) {
    // Handle known business logic errors
    if (error && typeof error === "object" && "status" in error && "code" in error && "message" in error) {
      const err = error as { status: number; code: string; message: string };
      logError("Business logic error in mark blackout", {
        userId,
        partyId: params.id,
        code: err.code,
        message: err.message,
      });
      return createErrorResponse(
        { code: err.code, message: err.message },
        err.status
      );
    }

    // Handle unexpected errors
    logError("Unexpected error in mark blackout endpoint", {
      userId,
      partyId: params.id,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return createErrorResponse(
      { code: "INTERNAL_ERROR", message: "An unexpected error occurred. Please try again later." },
      500
    );
  }
};
