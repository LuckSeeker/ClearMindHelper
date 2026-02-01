import type { APIRoute } from "astro";
import { ERROR_CODES } from "../../lib/constants";
import { logError, logInfo } from "../../lib/logger";
import { getPartyList, startParty, getPartyDetails } from "../../lib/services/party.service";
import { PartyListQuerySchema, StartPartySchema } from "../../lib/validation/party.validation";
import {
  parseJsonBody,
  createValidationErrorResponse,
  CommonErrors,
  createErrorResponse,
  createSuccessResponse,
  validateSupabaseClient,
  getUserIdFromSupabase,
} from "../../lib/api-helpers";
import type { PartyListResponseDTO, PartyDetailDTO } from "../../types";

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const supabaseResult = validateSupabaseClient(locals.supabase);
    if (!supabaseResult.success) return supabaseResult.response;
    const supabase = supabaseResult.value;

    // Get authenticated user id from Supabase session (via helper)
    const userIdResult = await getUserIdFromSupabase(supabase);
    if (!userIdResult.success) return userIdResult.response;
    const userId = userIdResult.value;

    // Parse and validate query parameters
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
      const errors = validationResult.error.errors;
      logError("Validation failed for GET /api/parties", { userId, errors });
      return createErrorResponse(
        {
          code: "VALIDATION_FAILED",
          message: "Invalid query parameters",
        },
        400,
        { errors: errors.map((err) => ({ field: err.path.join("."), message: err.message, code: err.code })) }
      );
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
      return createSuccessResponse<PartyListResponseDTO>(result, 200);
    } catch (serviceError) {
      if (serviceError instanceof Error) {
        logError("Service error in GET /api/parties", { userId, error: serviceError.message });
        return CommonErrors.databaseError("Failed to retrieve parties. Please try again later.");
      }
      throw serviceError;
    }
  } catch (error) {
    logError("Unexpected error in GET /api/parties", { error });
    return CommonErrors.internalError();
  }
};
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

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const supabaseResult = validateSupabaseClient(locals.supabase);
    if (!supabaseResult.success) return supabaseResult.response;
    const supabase = supabaseResult.value;

    // Get authenticated user id from Supabase session (via helper)
    const userIdResult = await getUserIdFromSupabase(supabase);
    if (!userIdResult.success) return userIdResult.response;
    const userId = userIdResult.value;

    const bodyResult = await parseJsonBody(request);
    if (!bodyResult.success) return bodyResult.response;

    const validationResult = StartPartySchema.safeParse(bodyResult.value);
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error);
    }

    try {
      const party = await startParty(supabase, userId, validationResult.data.started_at);
      logInfo("Party started successfully", { userId, partyId: party.id });

      // Pobierz pełne szczegóły partii (z napojami, alertami, BAC)
      const partyDetail = await getPartyDetails(supabase, userId, party.id);

      return new Response(JSON.stringify(partyDetail satisfies PartyDetailDTO), {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          Location: `/api/parties/${party.id}`,
        },
      });
    } catch (serviceError) {
      if (serviceError instanceof Error) {
        const errorMessage = serviceError.message;

        if (errorMessage === ERROR_CODES.PROFILE_NOT_FOUND) {
          return createErrorResponse(
            {
              code: ERROR_CODES.PROFILE_NOT_FOUND,
              message: "User profile not found. Please create your profile first.",
            },
            400
          );
        }

        if (errorMessage.startsWith(`${ERROR_CODES.PROFILE_INCOMPLETE}:`)) {
          const missingFields = errorMessage.replace(`${ERROR_CODES.PROFILE_INCOMPLETE}:`, "").split(",");
          return createErrorResponse(
            {
              code: ERROR_CODES.PROFILE_INCOMPLETE,
              message: "User profile is incomplete. Please complete your profile before starting a party.",
            },
            400,
            { missing_fields: missingFields, required_fields: ["height_cm", "weight_kg", "gender"] }
          );
        }

        if (errorMessage === ERROR_CODES.PARTY_ALREADY_ONGOING) {
          return CommonErrors.conflict("You already have an ongoing party. Please close it before starting a new one.");
        }

        logError("Service error in POST /api/parties", { userId, error: errorMessage });
        return CommonErrors.internalError("Failed to create party. Please try again later.");
      }

      logError("Unknown error in POST /api/parties", { error: serviceError });
      return CommonErrors.internalError();
    }
  } catch (error) {
    logError("Unexpected error in POST /api/parties", { error });
    return CommonErrors.internalError();
  }
};
