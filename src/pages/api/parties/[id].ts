/**
 * GET /api/parties/:id - Get Party Details Endpoint
 *
 * Returns detailed information about a specific party including:
 * - Complete party data with profile snapshot
 * - All drinks ordered chronologically with BAC calculations
 * - Current BAC (for ongoing parties)
 * - Active alerts
 *
 * Requires authentication via Bearer token.
 *
 * Responses:
 * - 200: Party details retrieved successfully
 * - 400: Invalid party ID parameter
 * - 401: Missing or invalid authentication token
 * - 404: Party not found or access denied (same response for security)
 * - 500: Internal server error
 */

import type { APIRoute } from "astro";

import { DEFAULT_USER_ID } from "../../../db/supabase.client";
import { PartyIdParamSchema } from "../../../lib/validation/party.validation";
import { getPartyDetails } from "../../../lib/services/party.service";
import { logError } from "../../../lib/logger";
import { createValidationErrorResponse, createSuccessResponse, CommonErrors } from "../../../lib/api-helpers";

// Disable prerendering for this API route
export const prerender = false;

/**
 * GET handler for fetching party details by ID
 */
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    // Step 1: Check Supabase client availability
    const supabase = locals.supabase;
    if (!supabase) {
      logError("Supabase client not available");
      return CommonErrors.supabaseUnavailable();
    }

    // DEVELOPMENT MODE: Use default user ID instead of authentication
    // TODO: Replace with proper JWT authentication
    const userId = DEFAULT_USER_ID;

    // Step 2: Validate party ID parameter
    const validation = PartyIdParamSchema.safeParse({ id: params.id });
    if (!validation.success) {
      logError("Invalid party ID parameter", validation.error);
      return createValidationErrorResponse(validation.error, "Party ID must be a positive integer");
    }

    const partyId = validation.data.id;

    // Step 3: Fetch party details from service layer
    const partyDetails = await getPartyDetails(supabase, userId, partyId);

    return createSuccessResponse(partyDetails);
  } catch (error) {
    // Handle service errors
    if (error instanceof Error) {
      if (error.message === "PARTY_NOT_FOUND") {
        logError("Party not found", { error: error.message });
        return CommonErrors.partyNotFound();
      }
      if (error.message.startsWith("Database error:")) {
        logError("Database error while fetching party details", { error: error.message });
        return CommonErrors.internalError();
      }
    }

    // Handle unexpected errors
    logError("Unexpected error in GET /api/parties/:id", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return CommonErrors.internalError();
  }
};
