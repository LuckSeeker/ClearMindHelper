/**
 * PATCH /api/parties/:id/close - Close Party Endpoint
 *
 * Closes an ongoing party session by:
 * - Updating party status to 'closed'
 * - Setting ended_at timestamp
 * - Deactivating all active alerts
 * - Logging 'party_closed' event
 *
 * A closed party cannot be modified further - no new drinks can be added
 * and existing drinks cannot be updated.
 *
 * Requires authentication via Bearer token.
 *
 * Responses:
 * - 200: Party closed successfully
 * - 400: Invalid input or party already closed
 * - 401: Missing or invalid authentication token
 * - 403: User does not own this party (returns 404 for security)
 * - 404: Party not found
 * - 500: Internal server error
 */

import type { APIRoute } from "astro";

import { PartyIdParamSchema, ClosePartySchema } from "../../../../lib/validation/party.validation";
import { closeParty } from "../../../../lib/services/party.service";
import { logError, logInfo } from "../../../../lib/logger";
import { createErrorResponse, getUserIdFromSupabase } from "../../../../lib/api-helpers";

// Disable prerendering for this API route
export const prerender = false;

/**
 * PATCH handler for closing a party
 */
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const requestId = crypto.randomUUID();

  try {
    // Step 1: Check Supabase client availability
    const supabase = locals.supabase;

    if (!supabase) {
      logError("Supabase client not available", { requestId });
      return createErrorResponse({ code: "INTERNAL_SERVER_ERROR", message: "Database connection not available" }, 500);
    }

    // Get authenticated user id from Supabase session (via helper)
    const userIdResult = await getUserIdFromSupabase(supabase);
    if (!userIdResult.success) return userIdResult.response;
    const userId = userIdResult.value;

    // Step 2: Validate party ID parameter
    const paramsValidation = PartyIdParamSchema.safeParse({ id: params.id });

    if (!paramsValidation.success) {
      const errors = paramsValidation.error.errors;
      logError("Invalid party ID parameter", {
        requestId,
        userId,
        partyId: params.id,
        errors,
      });

      return createErrorResponse(
        {
          code: "INVALID_PARTY_ID",
          message: "Party ID must be a positive integer",
        },
        400,
        {
          field: "id",
          value: params.id,
          issues: errors.map((e) => e.message),
        }
      );
    }

    const partyId = paramsValidation.data.id;

    // Step 3: Parse and validate request body
    let requestBody;
    try {
      const contentType = request.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        requestBody = await request.json();
      } else {
        requestBody = {};
      }
    } catch (error) {
      logError("Failed to parse request body", {
        requestId,
        userId,
        partyId,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return createErrorResponse(
        {
          code: "INVALID_REQUEST_BODY",
          message: "Request body must be valid JSON",
        },
        400
      );
    }

    const bodyValidation = ClosePartySchema.safeParse(requestBody);

    if (!bodyValidation.success) {
      const errors = bodyValidation.error.errors;
      logError("Invalid request body", {
        requestId,
        userId,
        partyId,
        body: requestBody,
        errors,
      });

      return createErrorResponse(
        {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
        },
        400,
        {
          issues: errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        }
      );
    }

    const closePartyCommand = bodyValidation.data;

    // Step 4: Close party via service layer
    try {
      const result = await closeParty(supabase, userId, partyId, closePartyCommand);

      logInfo("Party closed successfully", {
        requestId,
        userId,
        partyId,
        endedAt: result.ended_at,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      // Handle specific business logic errors from service layer
      if (error instanceof Error) {
        const errorMessage = error.message;

        // Party not found
        if (errorMessage === "PARTY_NOT_FOUND") {
          logError("Party not found or access denied", {
            requestId,
            userId,
            partyId,
          });

          return createErrorResponse(
            {
              code: "PARTY_NOT_FOUND",
              message: "Party not found or you don't have access to it",
            },
            404
          );
        }

        // Party already closed
        if (errorMessage === "PARTY_ALREADY_CLOSED") {
          logError("Attempt to close already closed party", {
            requestId,
            userId,
            partyId,
          });

          return createErrorResponse(
            {
              code: "PARTY_ALREADY_CLOSED",
              message: "Party is already closed and cannot be closed again",
            },
            400
          );
        }

        // Invalid ended_at timestamp
        if (errorMessage === "INVALID_ENDED_AT") {
          logError("Invalid ended_at timestamp", {
            requestId,
            userId,
            partyId,
            endedAt: closePartyCommand.ended_at,
          });

          return createErrorResponse(
            {
              code: "INVALID_ENDED_AT",
              message: "ended_at must be after party start time and within 5 minutes of current time (past or future)",
            },
            400,
            {
              field: "ended_at",
              value: closePartyCommand.ended_at,
            }
          );
        }
      }

      // Unknown error - rethrow to be caught by outer catch
      throw error;
    }
  } catch (error) {
    // Handle unexpected errors
    logError("Unexpected error closing party", {
      requestId,
      partyId: params.id,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return createErrorResponse(
      {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred while closing the party",
      },
      500
    );
  }
};
