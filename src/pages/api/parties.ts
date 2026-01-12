/**
 * POST /api/parties
 *
 * Starts a new party session for the authenticated user.
 * Creates a party record with status 'ongoing' and captures an immutable
 * snapshot of the user's profile (height, weight, gender) at start time.
 *
 * Authentication: Required (JWT token in Authorization header)
 * Authorization: User can only start parties for themselves
 *
 * Request Body:
 *   - started_at: string (optional) - ISO 8601 datetime, defaults to current time
 *
 * Success Response (201):
 *   - PartyDTO with all party fields including profile_snapshot
 *
 * Error Responses:
 *   - 400: Invalid request body, incomplete profile, or validation failed
 *   - 401: Missing or invalid authentication token
 *   - 409: User already has an ongoing party
 *   - 500: Internal server error (database or unexpected error)
 *
 * ---
 *
 * GET /api/parties
 *
 * Gets paginated list of user's parties with drink previews.
 * Supports filtering by status, sorting, and pagination.
 *
 * Authentication: Required (JWT token in Authorization header)
 * Authorization: User can only view their own parties
 *
 * Query Parameters:
 *   - page: number (optional, default: 1) - Page number (>= 1)
 *   - limit: number (optional, default: 20) - Items per page (1-100)
 *   - status: 'ongoing' | 'closed' (optional) - Filter by party status
 *   - sort: 'started_at' | 'bac_estimate_max' (optional, default: 'started_at')
 *   - order: 'asc' | 'desc' (optional, default: 'desc')
 *
 * Success Response (200):
 *   - PartyListResponseDTO with paginated parties and metadata
 *
 * Error Responses:
 *   - 400: Invalid query parameters or validation failed
 *   - 401: Missing or invalid authentication token
 *   - 500: Internal server error (database or unexpected error)
 */

import type { APIRoute } from "astro";

import { DEFAULT_USER_ID } from "../../db/supabase.client";
import { logError, logInfo, logWarning } from "../../lib/logger";
import { startParty, getPartyList } from "../../lib/services/party.service";
import { StartPartySchema, PartyListQuerySchema } from "../../lib/validation/party.validation";
import type { APIError, PartyDTO, PartyListResponseDTO } from "../../types";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Extract Supabase client from middleware
    const supabase = locals.supabase;

    if (!supabase) {
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

    // Parse and validate request body
    let body: unknown;
    try {
      const text = await request.text();
      // Allow empty body for POST /api/parties
      body = text ? JSON.parse(text) : {};
    } catch (error) {
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

    // Validate request body against schema
    const validationResult = StartPartySchema.safeParse(body);
    if (!validationResult.success) {
      const formattedErrors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
        code: err.code,
      }));

      logWarning("Validation failed for POST /api/parties", { userId, errors: formattedErrors });

      return new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_FAILED",
            message: "Validation failed",
            details: { errors: formattedErrors },
          },
        } satisfies APIError),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Call service to start party
    try {
      const party = await startParty(supabase, userId, validationResult.data.started_at);

      logInfo("Party started successfully", { userId, partyId: party.id });

      // Return successful response with party data
      return new Response(JSON.stringify(party satisfies PartyDTO), {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          Location: `/api/parties/${party.id}`,
        },
      });
    } catch (serviceError) {
      // Handle specific business logic errors from PartyService
      if (serviceError instanceof Error) {
        const errorMessage = serviceError.message;

        // Profile not found error
        if (errorMessage === "PROFILE_NOT_FOUND") {
          return new Response(
            JSON.stringify({
              error: {
                code: "PROFILE_NOT_FOUND",
                message: "User profile not found. Please create your profile first.",
              },
            } satisfies APIError),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        // Incomplete profile error
        if (errorMessage.startsWith("PROFILE_INCOMPLETE:")) {
          const missingFields = errorMessage.replace("PROFILE_INCOMPLETE:", "").split(",");
          return new Response(
            JSON.stringify({
              error: {
                code: "PROFILE_INCOMPLETE",
                message: "User profile is incomplete. Please complete your profile before starting a party.",
                details: {
                  missing_fields: missingFields,
                  required_fields: ["height_cm", "weight_kg", "gender"],
                },
              },
            } satisfies APIError),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        // Ongoing party conflict
        if (errorMessage === "PARTY_ALREADY_ONGOING") {
          return new Response(
            JSON.stringify({
              error: {
                code: "PARTY_ALREADY_ONGOING",
                message: "You already have an ongoing party. Please close it before starting a new one.",
                details: {
                  action: "Close the current party at POST /api/parties/{id}/close",
                },
              },
            } satisfies APIError),
            {
              status: 409,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        // Database or other errors from service
        logError("Service error in POST /api/parties", { userId, error: errorMessage });
        return new Response(
          JSON.stringify({
            error: {
              code: "DATABASE_ERROR",
              message: "Failed to create party. Please try again later.",
              details: process.env.NODE_ENV === "development" ? { error: errorMessage } : undefined,
            },
          } satisfies APIError),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Unknown error type
      throw serviceError;
    }
  } catch (error) {
    // Log unexpected errors for monitoring
    logError("Unexpected error in POST /api/parties:", error);

    // Return generic error response
    return new Response(
      JSON.stringify({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred. Please try again later.",
          details: process.env.NODE_ENV === "development" ? { error: String(error) } : undefined,
        },
      } satisfies APIError),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    // Extract Supabase client from middleware
    const supabase = locals.supabase;

    if (!supabase) {
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

    // Parse query parameters
    const searchParams = url.searchParams;
    const queryParams = {
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
      order: searchParams.get("order") ?? undefined,
    };

    // Validate query parameters
    const validationResult = PartyListQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      const formattedErrors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
        code: err.code,
      }));

      logWarning("Validation failed for GET /api/parties", { userId, errors: formattedErrors });

      return new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid query parameters",
            details: { errors: formattedErrors },
          },
        } satisfies APIError),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { page, limit, status, sort, order } = validationResult.data;

    // Call service to get party list
    try {
      const result = await getPartyList(supabase, userId, { ...(status && { status }) }, { page, limit, sort, order });

      logInfo("Party list retrieved successfully", {
        userId,
        page,
        limit,
        totalCount: result.pagination.total_count,
      });

      // Return successful response with party list
      return new Response(JSON.stringify(result satisfies PartyListResponseDTO), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (serviceError) {
      // Handle errors from PartyService
      if (serviceError instanceof Error) {
        const errorMessage = serviceError.message;

        // Database errors from service
        logError("Service error in GET /api/parties", { userId, error: errorMessage });
        return new Response(
          JSON.stringify({
            error: {
              code: "DATABASE_ERROR",
              message: "Failed to retrieve parties. Please try again later.",
              details: process.env.NODE_ENV === "development" ? { error: errorMessage } : undefined,
            },
          } satisfies APIError),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Unknown error type
      throw serviceError;
    }
  } catch (error) {
    // Log unexpected errors for monitoring
    logError("Unexpected error in GET /api/parties:", error);

    // Return generic error response
    return new Response(
      JSON.stringify({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred. Please try again later.",
          details: process.env.NODE_ENV === "development" ? { error: String(error) } : undefined,
        },
      } satisfies APIError),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
