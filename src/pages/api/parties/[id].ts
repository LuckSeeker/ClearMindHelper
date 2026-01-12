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
import { logError, logInfo } from "../../../lib/logger";

// Disable prerendering for this API route
export const prerender = false;

/**
 * GET handler for fetching party details by ID
 */
export const GET: APIRoute = async ({ params, locals }) => {
  const requestId = crypto.randomUUID();

  try {
    // Step 1: Check Supabase client availability
    const supabase = locals.supabase;

    if (!supabase) {
      logError("Supabase client not available", { requestId });
      return new Response(
        JSON.stringify({
          error: "INTERNAL_SERVER_ERROR",
          message: "Database connection not available",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // DEVELOPMENT MODE: Use default user ID instead of authentication
    // TODO: Replace with proper JWT authentication
    const userId = DEFAULT_USER_ID;

    // Step 2: Validate party ID parameter
    const validation = PartyIdParamSchema.safeParse({ id: params.id });

    if (!validation.success) {
      const errors = validation.error.errors;
      logInfo("Invalid party ID parameter", {
        requestId,
        userId,
        partyId: params.id,
        errors,
      });

      return new Response(
        JSON.stringify({
          error: "INVALID_PARTY_ID",
          message: "Party ID must be a positive integer",
          details: {
            field: "id",
            value: params.id,
            issues: errors.map((e) => e.message),
          },
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const partyId = validation.data.id;

    // Step 3: Fetch party details from service layer
    try {
      const partyDetails = await getPartyDetails(supabase, userId, partyId);

      logInfo("Party details fetched successfully", {
        requestId,
        userId,
        partyId,
        drinksCount: partyDetails.drinks.length,
        activeAlertsCount: partyDetails.active_alerts.length,
      });

      return new Response(JSON.stringify(partyDetails), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
        },
      });
    } catch (serviceError) {
      // Handle specific service errors
      if (serviceError instanceof Error) {
        const errorMessage = serviceError.message;

        // Party not found or access denied
        if (errorMessage === "PARTY_NOT_FOUND") {
          logInfo("Party not found or access denied", {
            requestId,
            userId,
            partyId,
          });

          return new Response(
            JSON.stringify({
              error: "PARTY_NOT_FOUND",
              message: "Party with the specified ID does not exist",
            }),
            {
              status: 404,
              headers: {
                "Content-Type": "application/json",
              },
            }
          );
        }

        // Database errors
        if (errorMessage.startsWith("Database error:")) {
          logError("Database error while fetching party details", {
            requestId,
            userId,
            partyId,
            error: errorMessage,
          });

          return new Response(
            JSON.stringify({
              error: "INTERNAL_SERVER_ERROR",
              message: "An unexpected error occurred while fetching party details",
            }),
            {
              status: 500,
              headers: {
                "Content-Type": "application/json",
              },
            }
          );
        }
      }

      // Unexpected errors
      logError("Unexpected error in GET /api/parties/:id", {
        requestId,
        userId,
        partyId,
        error: serviceError instanceof Error ? serviceError.message : "Unknown error",
        stack: serviceError instanceof Error ? serviceError.stack : undefined,
      });

      return new Response(
        JSON.stringify({
          error: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred while processing your request",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }
  } catch (error) {
    // Catch-all for any unexpected errors in the handler itself
    logError("Unhandled error in GET /api/parties/:id endpoint", {
      requestId,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return new Response(
      JSON.stringify({
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred while processing your request",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
};
