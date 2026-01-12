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
import { DEFAULT_USER_ID } from "../../../../db/supabase.client";
import { PartyIdParamSchema, ClosePartySchema } from "../../../../lib/validation/party.validation";
import { closeParty } from "../../../../lib/services/party.service";
import { logError, logInfo } from "../../../../lib/logger";

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
      return new Response(
        JSON.stringify({
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Database connection not available",
          },
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
    const paramsValidation = PartyIdParamSchema.safeParse({ id: params.id });

    if (!paramsValidation.success) {
      const errors = paramsValidation.error.errors;
      logInfo("Invalid party ID parameter", {
        requestId,
        userId,
        partyId: params.id,
        errors,
      });

      return new Response(
        JSON.stringify({
          error: {
            code: "INVALID_PARTY_ID",
            message: "Party ID must be a positive integer",
            details: {
              field: "id",
              value: params.id,
              issues: errors.map((e) => e.message),
            },
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
      logInfo("Failed to parse request body", {
        requestId,
        userId,
        partyId,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return new Response(
        JSON.stringify({
          error: {
            code: "INVALID_REQUEST_BODY",
            message: "Request body must be valid JSON",
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

    const bodyValidation = ClosePartySchema.safeParse(requestBody);

    if (!bodyValidation.success) {
      const errors = bodyValidation.error.errors;
      logInfo("Invalid request body", {
        requestId,
        userId,
        partyId,
        body: requestBody,
        errors,
      });

      return new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: {
              issues: errors.map((e) => ({
                field: e.path.join("."),
                message: e.message,
              })),
            },
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
          logInfo("Party not found or access denied", {
            requestId,
            userId,
            partyId,
          });

          return new Response(
            JSON.stringify({
              error: {
                code: "PARTY_NOT_FOUND",
                message: "Party not found or you don't have access to it",
              },
            }),
            {
              status: 404,
              headers: {
                "Content-Type": "application/json",
              },
            }
          );
        }

        // Party already closed
        if (errorMessage === "PARTY_ALREADY_CLOSED") {
          logInfo("Attempt to close already closed party", {
            requestId,
            userId,
            partyId,
          });

          return new Response(
            JSON.stringify({
              error: {
                code: "PARTY_ALREADY_CLOSED",
                message: "Party is already closed and cannot be closed again",
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

        // Invalid ended_at timestamp
        if (errorMessage === "INVALID_ENDED_AT") {
          logInfo("Invalid ended_at timestamp", {
            requestId,
            userId,
            partyId,
            endedAt: closePartyCommand.ended_at,
          });

          return new Response(
            JSON.stringify({
              error: {
                code: "INVALID_ENDED_AT",
                message:
                  "ended_at must be after party start time and within 5 minutes of current time (past or future)",
                details: {
                  field: "ended_at",
                  value: closePartyCommand.ended_at,
                },
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

    return new Response(
      JSON.stringify({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred while closing the party",
        },
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
