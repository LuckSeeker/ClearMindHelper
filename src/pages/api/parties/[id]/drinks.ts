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
import { logError, logInfo, logWarning } from "../../../../lib/logger";
import { addDrinkToParty } from "../../../../lib/services/drink.service";
import { AddDrinkSchema } from "../../../../lib/validation/drink.validation";
import type {
  APIError,
  AddDrinkResponseDTO,
  ValidationWarningResponse,
  DrinkValidationWarning,
} from "../../../../types";

export const prerender = false;

export const POST: APIRoute = async ({ request, params, locals }) => {
  try {
    console.log("[DRINKS] POST request received", { partyId: params.id });
    
    // Extract Supabase client from middleware
    const supabase = locals.supabase;

    if (!supabase) {
      console.error("[DRINKS] Supabase client not available");
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

    // Parse and validate partyId from path parameter
    const partyId = parseInt(params.id || "", 10);
    console.log("[DRINKS] Parsed partyId:", partyId);

    if (isNaN(partyId) || partyId <= 0) {
      console.warn("[DRINKS] Invalid partyId", params.id);
      logWarning("Invalid partyId in path", { partyId: params.id });
      return new Response(
        JSON.stringify({
          error: {
            code: "INVALID_PARTY_ID",
            message: "Party ID must be a positive integer",
          },
        } satisfies APIError),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      const text = await request.text();
      console.log("[DRINKS] Request body text:", text);
      body = text ? JSON.parse(text) : {};
      console.log("[DRINKS] Parsed body:", body);
    } catch (error) {
      console.error("[DRINKS] JSON parse error:", error);
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

    // Validate request body with Zod schema
    console.log("[DRINKS] Validating with Zod schema");
    const validation = AddDrinkSchema.safeParse(body);

    if (!validation.success) {
      console.warn("[DRINKS] Zod validation failed:", validation.error.errors);
      const firstError = validation.error.errors[0];
      logWarning("Request validation failed", {
        errors: validation.error.errors,
        body,
      });
      return new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message: firstError.message,
            details: {
              field: firstError.path.join("."),
              issues: validation.error.errors,
            },
          },
        } satisfies APIError),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Call service layer to add drink
    const command = validation.data;
    console.log("[DRINKS] Calling addDrinkToParty service", { userId, partyId, command });
    logInfo("Adding drink to party", { userId, partyId, command });

    const result = await addDrinkToParty(supabase, userId, partyId, command);
    console.log("[DRINKS] Service returned successfully", { drinkId: result.drink.id });

    logInfo("Successfully added drink to party", { partyId, drinkId: result.drink.id });

    return new Response(JSON.stringify(result satisfies AddDrinkResponseDTO), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
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
        logWarning("Validation warnings require confirmation", {
          warnings: err.warnings,
        });
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

      // Handle known errors (400, 403, 404)
      if (err.status && err.code) {
        logWarning("Business logic error", {
          code: err.code,
          message: err.message,
          status: err.status,
        });
        return new Response(
          JSON.stringify({
            error: {
              code: err.code,
              message: err.message,
            },
          } satisfies APIError),
          {
            status: err.status,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Handle unexpected errors (500)
    console.error("[DRINKS] Unexpected error:", error);
    console.error("[DRINKS] Error stack:", error instanceof Error ? error.stack : "No stack");
    logError("Unexpected error in POST /api/parties/:id/drinks", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

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
};
