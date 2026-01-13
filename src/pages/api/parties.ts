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
import { logError, logInfo } from "../../lib/logger";
import { startParty, getPartyList } from "../../lib/services/party.service";
import { StartPartySchema, PartyListQuerySchema } from "../../lib/validation/party.validation";
import {
  parseJsonBody,
  createValidationErrorResponse,
  createSuccessResponse,
  CommonErrors,
  createErrorResponse,
} from "../../lib/api-helpers";
import type { PartyDTO } from "../../types";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const supabase = locals.supabase;
    if (!supabase) {
      logError("Supabase client not available in locals");
      return CommonErrors.supabaseUnavailable();
    }

    const userId = DEFAULT_USER_ID;

    const bodyResult = await parseJsonBody(request);
    if (!bodyResult.success) return bodyResult.response;

    const validationResult = StartPartySchema.safeParse(bodyResult.value);
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error);
    }

    try {
      const party = await startParty(supabase, userId, validationResult.data.started_at);
      logInfo("Party started successfully", { userId, partyId: party.id });

      return new Response(JSON.stringify(party satisfies PartyDTO), {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          Location: `/api/parties/${party.id}`,
        },
      });
    } catch (serviceError) {
      if (serviceError instanceof Error) {
        const errorMessage = serviceError.message;

        if (errorMessage === "PROFILE_NOT_FOUND") {
          return createErrorResponse(
            { code: "PROFILE_NOT_FOUND", message: "User profile not found. Please create your profile first." },
            400
          );
        }

        if (errorMessage.startsWith("PROFILE_INCOMPLETE:")) {
          const missingFields = errorMessage.replace("PROFILE_INCOMPLETE:", "").split(",");
          return createErrorResponse(
            {
              code: "PROFILE_INCOMPLETE",
              message: "User profile is incomplete. Please complete your profile before starting a party.",
            },
            400,
            { missing_fields: missingFields, required_fields: ["height_cm", "weight_kg", "gender"] }
          );
        }

        if (errorMessage === "PARTY_ALREADY_ONGOING") {
          return CommonErrors.conflict("You already have an ongoing party. Please close it before starting a new one.");
        }

        logError("Service error in POST /api/parties", { userId, error: errorMessage });
        return CommonErrors.internalError("Failed to create party. Please try again later.");
      }

      throw serviceError;
    }
  } catch (error) {
    logError("Unexpected error in POST /api/parties:", error);
    return CommonErrors.internalError();
  }
};

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const supabase = locals.supabase;
    if (!supabase) {
      logError("Supabase client not available in locals");
      return CommonErrors.supabaseUnavailable();
    }

    const userId = DEFAULT_USER_ID;

    const searchParams = url.searchParams;
    const queryParams = {
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
      order: searchParams.get("order") ?? undefined,
    };

    const validationResult = PartyListQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error, "Invalid query parameters");
    }

    const { page, limit, status, sort, order } = validationResult.data;

    try {
      const result = await getPartyList(supabase, userId, { ...(status && { status }) }, { page, limit, sort, order });

      logInfo("Party list retrieved successfully", {
        userId,
        page,
        limit,
        totalCount: result.pagination.total_count,
      });

      return createSuccessResponse(result);
    } catch (serviceError) {
      if (serviceError instanceof Error) {
        logError("Service error in GET /api/parties", { userId, error: serviceError.message });
        return CommonErrors.internalError("Failed to retrieve parties. Please try again later.");
      }

      throw serviceError;
    }
  } catch (error) {
    logError("Unexpected error in GET /api/parties:", error);
    return CommonErrors.internalError();
  }
};
