/**
 * GET /api/parties/:id/drinks
 *
 * Retrieves all drinks consumed during a specific party with optional BAC calculations.
 * Implements User Story US-009.
 *
 * Authentication: Required (JWT token in Authorization header)
 * Authorization: User must own the party
 *
 * Path Parameters:
 *   - id: number - The party's ID
 *
 * Query Parameters:
 *   - include_bac: boolean (optional) - Include BAC calculations, defaults to true
 *
 * Success Response (200):
 *   - PartyDrinksResponseDTO with drinks list and metadata
 *
 * Error Responses:
 *   - 400: Invalid party ID format or query parameters
 *   - 401: Missing or invalid authentication token
 *   - 403: Party belongs to another user
 *   - 404: Party not found
 *   - 500: Internal server error (database or unexpected error)
 *
 * POST /api/parties/:id/drinks
 *
 * Adds a new drink to an ongoing party session.
 * Calculates BAC using Widmark formula, manages alerts, and updates party statistics.
 *
 * Authentication: Required (JWT token in Authorization header)
 * Authorization: User must own the party
 *
 * Path Parameters:
 *   - id: number - The party's ID
 *
 * Request Body:
 *   - volume_ml: number (required) - Volume in ml (>0, ≤5000)
 *   - abv_percent: number (required) - ABV percentage (0-100)
 *   - consumed_at: string (optional) - ISO 8601 datetime, defaults to current time
 *   - confirm_warnings: boolean (optional) - Set to true to confirm validation warnings
 *
 * Success Response (201):
 *   - AddDrinkResponseDTO with drink, BAC calculation, warnings, and active alerts
 *
 * Error Responses:
 *   - 400: Invalid request body, party closed, or consumed_at out of range
 *   - 401: Missing or invalid authentication token
 *   - 403: Party belongs to another user
 *   - 404: Party not found
 *   - 422: Validation warnings require confirmation
 *   - 500: Internal server error (database or unexpected error)
 */

import type { APIRoute } from "astro";

import { logError, logWarning, logInfo } from "../../../../lib/logger";
import {
  parsePositiveIntParam,
  parseJsonBody,
  createValidationErrorResponse,
  createSuccessResponse,
  createErrorResponseFromThrown,
  CommonErrors,
  getAuthenticatedUserId,
  verifyPartyOwnership,
} from "../../../../lib/api-helpers";
import { addDrinkToParty, getDrinksByPartyId } from "../../../../lib/services/drink.service";
import { AddDrinkSchema, PartyDrinksQueryParamsSchema } from "../../../../lib/validation/drink.validation";
import type { ValidationWarningResponse, DrinkValidationWarning } from "../../../../types";

export const prerender = false;

// ============================================================================
// GET Handler
// ============================================================================

export const GET: APIRoute = async ({ params, url, locals }) => {
  const supabase = locals.supabase;

  // Step 1: Authentication check
  const userIdResult = getAuthenticatedUserId();
  if (!userIdResult.success) return userIdResult.response;
  const userId = userIdResult.value;

  try {
    // Step 2: Validate partyId from path params
    const partyIdResult = parsePositiveIntParam(params.id, "partyId");
    if (!partyIdResult.success) return partyIdResult.response;
    const partyId = partyIdResult.value;

    // Step 3: Validate query parameters
    const queryParamsResult = PartyDrinksQueryParamsSchema.safeParse({
      include_bac: url.searchParams.get("include_bac"),
    });

    if (!queryParamsResult.success) {
      return createValidationErrorResponse(queryParamsResult.error, "Invalid query parameters");
    }

    const { include_bac } = queryParamsResult.data;

    // Step 4: Verify party exists and belongs to user
    const partyResult = await verifyPartyOwnership(supabase, partyId, userId, "GET drinks");
    if (!partyResult.success) return partyResult.response;

    // Step 5: Fetch drinks with optional BAC calculations
    const drinksResponse = await getDrinksByPartyId(supabase, partyId, include_bac);

    logInfo("Successfully retrieved party drinks", {
      userId,
      partyId,
      drinkCount: drinksResponse.total_count,
      includeBac: include_bac,
    });

    // Step 6: Return response
    return createSuccessResponse(drinksResponse);
  } catch (error) {
    // Unexpected errors
    logError("Unexpected error in GET drinks", {
      userId,
      partyId: params.id,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return CommonErrors.internalError();
  }
};

// ============================================================================
// POST Handler
// ============================================================================

export const POST: APIRoute = async ({ request, params, locals }) => {
  try {
    // Extract Supabase client from middleware
    const supabase = locals.supabase;
    if (!supabase) {
      logError("Supabase client not available in locals");
      return CommonErrors.supabaseUnavailable();
    }

    // Authentication check
    const userIdResult = getAuthenticatedUserId();
    if (!userIdResult.success) return userIdResult.response;
    const userId = userIdResult.value;

    // Parse and validate partyId from path parameter
    const partyIdResult = parsePositiveIntParam(params.id, "partyId");
    if (!partyIdResult.success) return partyIdResult.response;
    const partyId = partyIdResult.value;

    // Parse and validate request body
    const bodyResult = await parseJsonBody(request);
    if (!bodyResult.success) return bodyResult.response;

    // Validate request body with Zod schema
    const validation = AddDrinkSchema.safeParse(bodyResult.value);
    if (!validation.success) {
      return createValidationErrorResponse(validation.error);
    }

    // Call service layer to add drink
    const result = await addDrinkToParty(supabase, userId, partyId, validation.data);
    return createSuccessResponse(result, 201);
  } catch (error) {
    // Handle custom errors with status codes
    if (error instanceof Error) {
      const err = error as Error & {
        code?: string;
        status?: number;
        warnings?: DrinkValidationWarning[];
      };

      // Handle validation warnings (422)
      if (err.status === 422 && err.warnings) {
        logWarning("Validation warnings require confirmation", { warnings: err.warnings });
        return new Response(
          JSON.stringify({
            warnings: err.warnings,
            requires_confirmation: true,
          } satisfies ValidationWarningResponse),
          {
            status: 422,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Handle common business logic errors
      if (err.code === "PARTY_NOT_FOUND") return CommonErrors.partyNotFound();
      if (err.code === "FORBIDDEN") return CommonErrors.forbidden();
      if (err.code === "PARTY_CLOSED") return CommonErrors.partyClosed("add drinks to");

      // Handle other known errors with code and status
      const errorResponse = createErrorResponseFromThrown(err);
      if (errorResponse) return errorResponse;
    }

    // Handle unexpected errors (500)
    logError("Unexpected error in POST /api/parties/:id/drinks", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return CommonErrors.internalError();
  }
};
