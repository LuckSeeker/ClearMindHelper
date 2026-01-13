/**
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

import { DEFAULT_USER_ID } from "../../../../db/supabase.client";
import { logError, logWarning } from "../../../../lib/logger";
import {
  parsePositiveIntParam,
  parseJsonBody,
  createValidationErrorResponse,
  createSuccessResponse,
  createErrorResponseFromThrown,
  CommonErrors,
} from "../../../../lib/api-helpers";
import { addDrinkToParty } from "../../../../lib/services/drink.service";
import { AddDrinkSchema } from "../../../../lib/validation/drink.validation";
import type { ValidationWarningResponse, DrinkValidationWarning } from "../../../../types";

export const prerender = false;

export const POST: APIRoute = async ({ request, params, locals }) => {
  try {
    // Extract Supabase client from middleware
    const supabase = locals.supabase;
    if (!supabase) {
      logError("Supabase client not available in locals");
      return CommonErrors.supabaseUnavailable();
    }

    // DEVELOPMENT MODE: Use default user ID instead of authentication
    // TODO: Replace with proper JWT authentication
    const userId = DEFAULT_USER_ID;

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
