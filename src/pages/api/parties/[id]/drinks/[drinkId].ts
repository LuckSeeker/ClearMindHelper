/**
 * PUT /api/parties/:id/drinks/:drinkId
 *
 * Updates the last drink in an ongoing party session.
 * Recalculates BAC, manages alerts, and updates party statistics.
 *
 * Authentication: Required (JWT token in Authorization header)
 * Authorization: User must own the party
 *
 * Path Parameters:
 *   - id: number - The party's ID
 *   - drinkId: number - The drink's ID
 *
 * Request Body:
 *   - volume_ml: number (required) - Volume in ml (>0, ≤5000)
 *   - abv_percent: number (required) - ABV percentage (0.1-100)
 *
 * Success Response (200):
 *   - UpdateDrinkResponseDTO with updated drink, recalculated BAC, warnings, and active alerts
 *
 * Error Responses:
 *   - 400: Invalid request body or BAC would exceed limit
 *   - 401: Missing or invalid authentication token
 *   - 403: Party belongs to another user
 *   - 404: Party or drink not found
 *   - 409: Drink is not the last in party (cannot edit historical drinks)
 *   - 422: Party is closed
 *   - 500: Internal server error (database or unexpected error)
 */

import type { APIRoute } from "astro";

import { logError } from "../../../../../lib/logger";
import {
  parsePositiveIntParam,
  parseJsonBody,
  createValidationErrorResponse,
  createSuccessResponse,
  createErrorResponse,
  CommonErrors,
  validateSupabaseClient,
  getUserIdFromSupabase,
} from "../../../../../lib/api-helpers";
import { updateLastDrink } from "../../../../../lib/services/drink.service";
import { UpdateDrinkSchema } from "../../../../../lib/validation/drink.validation";
import type { DrinkValidationWarning } from "../../../../../types";

export const prerender = false;

export const PUT: APIRoute = async ({ request, params, locals }) => {
  try {
    // Extract Supabase client from middleware
    const supabaseResult = validateSupabaseClient(locals.supabase);
    if (!supabaseResult.success) {
      logError("Supabase client validation failed in PUT drink", supabaseResult.response);
      return supabaseResult.response;
    }
    const supabase = supabaseResult.value;

    // Get authenticated user id from Supabase session (via helper)
    const userIdResult = await getUserIdFromSupabase(supabase);
    if (!userIdResult.success) return userIdResult.response;
    const userId = userIdResult.value;

    // Parse and validate partyId from path parameter
    const partyIdResult = parsePositiveIntParam(params.id, "partyId");
    if (!partyIdResult.success) {
      logError("Invalid partyId in PUT drink", partyIdResult.response);
      return partyIdResult.response;
    }
    const partyId = partyIdResult.value;

    // Parse and validate drinkId from path parameter
    const drinkIdResult = parsePositiveIntParam(params.drinkId, "drinkId");
    if (!drinkIdResult.success) {
      logError("Invalid drinkId in PUT drink", drinkIdResult.response);
      return drinkIdResult.response;
    }
    const drinkId = drinkIdResult.value;

    // Parse and validate request body
    const bodyResult = await parseJsonBody(request);
    if (!bodyResult.success) {
      logError("Invalid request body in PUT drink", bodyResult.response);
      return bodyResult.response;
    }

    // Validate request body with Zod schema
    const validationResult = UpdateDrinkSchema.safeParse(bodyResult.value);
    if (!validationResult.success) {
      logError("Request body validation failed in PUT drink", validationResult.error);
      return createValidationErrorResponse(validationResult.error);
    }

    const updateDrinkCommand = validationResult.data;

    // Call service layer to update drink
    try {
      const response = await updateLastDrink(supabase, userId, partyId, drinkId, updateDrinkCommand);
      return createSuccessResponse(response);
    } catch (serviceError) {
      // Handle known business logic errors
      const error = serviceError as Error & {
        code?: string;
        status?: number;
        warnings?: DrinkValidationWarning[];
      };

      // Handle specific error codes
      if (error.code === "PARTY_NOT_FOUND") {
        logError("Party not found in PUT drink", { error: error.message });
        return CommonErrors.partyNotFound();
      }
      if (error.code === "DRINK_NOT_FOUND") {
        logError("Drink not found in PUT drink", { error: error.message });
        return CommonErrors.drinkNotFound();
      }
      if (error.code === "FORBIDDEN") {
        logError("Forbidden in PUT drink", { error: error.message });
        return CommonErrors.forbidden("You don't have permission to edit this drink");
      }
      if (error.code === "PARTY_CLOSED") {
        logError("Party closed in PUT drink", { error: error.message });
        return CommonErrors.partyClosed("edit drinks in");
      }

      if (error.code === "NOT_LAST_DRINK") {
        logError("Not last drink edit attempt in PUT drink", { error: error.message });
        return createErrorResponse(
          {
            code: "NOT_LAST_DRINK",
            message: "Only the last drink can be edited",
          },
          409
        );
      }

      if (error.code === "BAC_LIMIT_EXCEEDED") {
        logError("BAC limit exceeded in PUT drink", { error: error.message });
        return createErrorResponse(
          {
            code: "BAC_LIMIT_EXCEEDED",
            message: error.message,
          },
          400
        );
      }

      // Handle unknown errors
      logError("Failed to update drink", {
        partyId,
        drinkId,
        userId,
        error: error.message,
      });

      return CommonErrors.internalError(
        "An unexpected error occurred while updating the drink. Please try again later."
      );
    }
  } catch (error) {
    // Handle unexpected errors at the top level
    logError("Unexpected error in PUT /api/parties/:id/drinks/:drinkId", {
      error: error instanceof Error ? error.message : String(error),
    });

    return CommonErrors.internalError();
  }
};
