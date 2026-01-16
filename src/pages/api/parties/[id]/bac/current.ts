/**
 * GET /api/parties/:id/bac/current - Get Current BAC Endpoint
 *
 * Calculates and returns the current estimated Blood Alcohol Concentration (BAC)
 * for an ongoing party with real-time decay calculation using Widmark algorithm.
 *
 * This is a read-only endpoint that does NOT save the calculation to the database.
 * It performs real-time calculations based on:
 * - Latest saved BAC calculation
 * - Time elapsed since last drink
 * - User's profile snapshot (weight, gender)
 * - Alcohol metabolism rate (Widmark formula)
 *
 * The endpoint also:
 * - Compares current BAC with user's personal threshold
 * - Determines threshold status (safe/approaching/exceeded)
 * - Calculates estimated time to reach BAC = 0.00‰
 *
 * Requires:
 * - Authentication via Bearer token
 * - Party must be in 'ongoing' status
 * - Party must have at least one drink (and BAC calculation)
 * - User must be the party owner
 *
 * Responses:
 * - 200: Current BAC calculated successfully
 * - 400: Invalid party ID format
 * - 401: Missing or invalid authentication token
 * - 403: User does not own this party (returns 404 for security)
 * - 404: Party not found / Party is closed / No drinks in party
 * - 500: Internal server error / Missing profile snapshot / No threshold found
 */

import type { APIRoute } from "astro";
import { getCurrentBAC } from "../../../../../lib/services/bac.service";
import { logError, logInfo } from "../../../../../lib/logger";
import {
  validateSupabaseClient,
  parsePositiveIntParam,
  createSuccessResponse,
  createErrorResponse,
  getAuthenticatedUserId,
} from "../../../../../lib/api-helpers";
import type { CurrentBACResponseDTO } from "../../../../../types";

// Disable prerendering for this API route
export const prerender = false;

/**
 * GET handler for current BAC calculation
 */
export const GET: APIRoute = async ({ params, locals }) => {
  const requestId = crypto.randomUUID();

  try {
    // Step 1: Check Supabase client availability
    const supabaseResult = validateSupabaseClient(locals.supabase, requestId);
    if (!supabaseResult.success) return supabaseResult.response;
    const supabase = supabaseResult.value;

    // Step 2: Validate party ID from URL params
    const partyIdResult = parsePositiveIntParam(params.id, "partyId");
    if (!partyIdResult.success) return partyIdResult.response;
    const partyId = partyIdResult.value;

    // Step 3: Get authenticated user ID
    const userIdResult = getAuthenticatedUserId();
    if (!userIdResult.success) return userIdResult.response;
    const userId = userIdResult.value;

    logInfo("Fetching current BAC for party", {
      requestId,
      partyId,
      userId,
    });

    // Step 4: Call service to get current BAC
    const currentBAC: CurrentBACResponseDTO = await getCurrentBAC(supabase, partyId, userId);

    logInfo("Current BAC calculated successfully", {
      requestId,
      partyId,
      currentBAC: currentBAC.current_bac,
      thresholdStatus: currentBAC.threshold_status,
    });

    // Step 5: Return success response
    return createSuccessResponse(currentBAC);
  } catch (error) {
    // Step 6: Error handling with specific error codes
    if (error instanceof Error) {
      // Map service errors to HTTP status codes
      switch (error.message) {
        case "PARTY_NOT_FOUND":
          logInfo("Party not found", { requestId, params });
          return createErrorResponse(
            {
              code: "PARTY_NOT_FOUND",
              message: "Party not found or you do not have access to it",
            },
            404
          );

        case "PARTY_CLOSED":
          logInfo("Party is closed", { requestId, params });
          return createErrorResponse(
            {
              code: "PARTY_CLOSED",
              message: "Cannot get current BAC for a closed party. Party must be ongoing.",
            },
            404
          );

        case "NO_DRINKS_IN_PARTY":
          logInfo("No drinks in party", { requestId, params });
          return createErrorResponse(
            {
              code: "NO_DRINKS_IN_PARTY",
              message: "Party has no drinks yet. Add a drink first to calculate BAC.",
            },
            404
          );

        case "NO_THRESHOLD_FOUND":
          logError("User has no current threshold", { requestId, error: error.message });
          return createErrorResponse(
            {
              code: "NO_THRESHOLD_FOUND",
              message: "User threshold not found. Please set a threshold first.",
            },
            500
          );

        case "INVALID_PROFILE_SNAPSHOT":
          logError("Invalid profile snapshot in BAC calculation", { requestId, error: error.message });
          return createErrorResponse(
            {
              code: "INVALID_PROFILE_SNAPSHOT",
              message: "Invalid profile snapshot data. Party data may be corrupted.",
            },
            500
          );

        case "MISSING_CALCULATION_TIMESTAMP":
          logError("Missing calculation timestamp in BAC data", { requestId, error: error.message });
          return createErrorResponse(
            {
              code: "MISSING_CALCULATION_TIMESTAMP",
              message: "BAC calculation data is incomplete. Please try again.",
            },
            500
          );

        default:
          // Unknown error - log and return generic 500
          logError("Unexpected error in getCurrentBAC", {
            requestId,
            error: error.message,
            stack: error.stack,
          });

          return createErrorResponse(
            {
              code: "INTERNAL_SERVER_ERROR",
              message: "An unexpected error occurred while calculating BAC",
            },
            500
          );
      }
    }

    // Non-Error object thrown - log and return 500
    logError("Non-Error object thrown in getCurrentBAC", { requestId, error });

    return createErrorResponse(
      {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
      },
      500
    );
  }
};
