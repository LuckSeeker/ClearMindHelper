/**
 * GET /api/parties/:id/bac/history - Get BAC History Endpoint
 *
 * Returns the complete historical BAC calculation data for a specific party
 * in chronological order. This endpoint supports visualization and analytics
 * features (US-009), allowing users to review their alcohol consumption patterns.
 *
 * Features:
 * - Returns all BAC calculations ordered by calculation_timestamp (ascending)
 * - Includes maximum BAC reached during the party
 * - Provides metadata useful for visualization (time metrics, metabolized alcohol)
 * - Transforms database JSONB snapshots to typed DTOs
 *
 * Requires:
 * - Authentication via Bearer token
 * - User must be the party owner (403 for other users' parties)
 *
 * Responses:
 * - 200: BAC history retrieved successfully
 * - 400: Invalid party ID format
 * - 401: Missing or invalid authentication token
 * - 403: User does not own this party
 * - 404: Party not found
 * - 500: Internal server error / Database error
 */

import type { APIRoute } from "astro";
import { getBACHistory } from "../../../../../lib/services/bac.service";
import { logError, logInfo } from "../../../../../lib/logger";
import {
  validateSupabaseClient,
  parsePositiveIntParam,
  createSuccessResponse,
  createErrorResponse,
  CommonErrors,
  getAuthenticatedUserId,
} from "../../../../../lib/api-helpers";
import type { BACHistoryResponseDTO } from "../../../../../types";

// Disable prerendering for this API route
export const prerender = false;

/**
 * GET handler for BAC history
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

    logInfo("Fetching BAC history for party", {
      requestId,
      partyId,
      userId,
    });

    // Step 4: Call service to get BAC history
    const history: BACHistoryResponseDTO = await getBACHistory(supabase, partyId, userId);

    logInfo("BAC history retrieved successfully", {
      requestId,
      partyId,
      userId,
      calculationsCount: history.total_count,
      maxBAC: history.bac_estimate_max,
    });

    // Step 5: Return success response
    return createSuccessResponse<BACHistoryResponseDTO>(history, 200);
  } catch (error) {
    // Error handling based on error message
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    switch (errorMessage) {
      case "PARTY_NOT_FOUND":
        logInfo("Party not found for BAC history", {
          requestId,
          partyId: params.id,
        });
        return createErrorResponse(
          { code: "PARTY_NOT_FOUND", message: "Party not found or you do not have access to it" },
          404
        );

      case "FORBIDDEN":
        logError("Unauthorized access attempt to BAC history", {
          requestId,
          partyId: params.id,
          error: errorMessage,
        });
        return createErrorResponse(
          { code: "FORBIDDEN", message: "You do not have permission to access this party's BAC history" },
          403
        );

      case "DATABASE_ERROR":
        logError("Database error while fetching BAC history", {
          requestId,
          partyId: params.id,
          error: error instanceof Error ? error.stack : errorMessage,
        });
        return CommonErrors.databaseError("Failed to retrieve BAC history due to a database error");

      default:
        // Unexpected errors
        logError("Unexpected error in GET /api/parties/:id/bac/history", {
          requestId,
          partyId: params.id,
          error: error instanceof Error ? error.stack : errorMessage,
        });
        return createErrorResponse(
          { code: "INTERNAL_ERROR", message: "An unexpected error occurred while retrieving BAC history" },
          500
        );
    }
  }
};
