/**
 * Gets authenticated user ID from Supabase client (server-side)
 * Returns ParseResult with userId or 401 error response
 *
 * @param supabase - Supabase client instance
 * @returns ParseResult with userId string or error Response
 *
 * @example
 * ```typescript
 * const userIdResult = await getUserIdFromSupabase(supabase);
 * if (!userIdResult.success) return userIdResult.response;
 * const userId = userIdResult.value;
 * ```
 */
export type ParseResult<T> = { success: true; value: T } | { success: false; response: Response };

export async function getUserIdFromSupabase(supabase: SupabaseClient): Promise<ParseResult<string>> {
  // Use getUser() for secure user authentication (recommended by Supabase)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return {
      success: false,
      response: CommonErrors.unauthorized(),
    };
  }
  return { success: true, value: user.id };
}
/**
 * API Helper Functions
 *
 * Reusable utilities for API endpoint handlers including:
 * - Parameter validation and parsing
 * - Standardized error response creation
 * - Common request/response patterns
 */

import type { APIError } from "../types";
import { logWarning, logError, logInfo } from "./logger";
import { type SupabaseClient } from "../db/supabase.client";

// ============================================================================
// Parameter Validation Helpers
// ============================================================================

/**
 * Result of parameter parsing - either success with value or error response
export type ParseResult<T> = { success: true; value: T } | { success: false; response: Response };

/**
/**
 * Validates Supabase client availability
 * Returns ParseResult with client or 500 error response
 *
 * @param supabase - Supabase client from locals
 * @param requestId - Optional request ID for logging
 * @returns ParseResult with SupabaseClient or error Response
 *
 * @example
 * const supabaseResult = validateSupabaseClient(locals.supabase, requestId);
 * if (!supabaseResult.success) return supabaseResult.response;
 * const supabase = supabaseResult.value;
 */
export function validateSupabaseClient(
  supabase: SupabaseClient | undefined,
  requestId?: string
): ParseResult<SupabaseClient> {
  if (!supabase) {
    logError("Supabase client not available", { requestId });
    return {
      success: false,
      response: createErrorResponse(
        {
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection not available",
        },
        500
      ),
    };
  }

  return { success: true, value: supabase };
}

/**
 * Parses and validates a positive integer ID from path parameter
 *
 * @param paramValue - Raw parameter value from URL path
 * @param paramName - Name of parameter for error messages (e.g., "partyId", "drinkId")
 * @returns ParseResult with either parsed number or error Response
 *
 * @example
 * const result = parsePositiveIntParam(params.id, "partyId");
 * if (!result.success) return result.response;
 * const partyId = result.value; // type: number
 */
export function parsePositiveIntParam(paramValue: string | undefined, paramName: string): ParseResult<number> {
  const parsed = parseInt(paramValue || "", 10);

  if (isNaN(parsed) || parsed <= 0) {
    logWarning(`Invalid ${paramName} in path`, { [paramName]: paramValue });
    return {
      success: false,
      response: createErrorResponse(
        {
          code: `INVALID_${paramName.toUpperCase()}`,
          message: `${paramName} must be a positive integer`,
        },
        400
      ),
    };
  }

  return { success: true, value: parsed };
}

/**
 * Parses JSON request body safely
 *
 * @param request - Astro Request object
 * @param allowEmpty - If true, returns empty object for empty body
 * @returns ParseResult with parsed object or error Response
 *
 * @example
 * const result = await parseJsonBody(request);
 * if (!result.success) return result.response;
 * const body = result.value; // type: unknown
 */
export async function parseJsonBody(request: Request, allowEmpty = true): Promise<ParseResult<unknown>> {
  try {
    const text = await request.text();
    const body = text ? JSON.parse(text) : allowEmpty ? {} : null;

    if (!allowEmpty && !text) {
      return {
        success: false,
        response: createErrorResponse(
          {
            code: "EMPTY_REQUEST_BODY",
            message: "Request body is required",
          },
          400
        ),
      };
    }

    return { success: true, value: body };
  } catch (parseError) {
    logWarning("Invalid JSON in request body", { error: parseError });
    return {
      success: false,
      response: createErrorResponse(
        {
          code: "INVALID_JSON",
          message: "Request body must be valid JSON",
        },
        400
      ),
    };
  }
}

/**
 * Verifies party exists and belongs to authenticated user
 * Common pattern for party-related endpoints
 *
 * @param supabase - Supabase client instance
 * @param partyId - Party ID to verify
 * @param userId - Authenticated user ID
 * @param context - Optional context for logging (e.g., "GET drinks", "POST drinks")
 * @returns ParseResult with party data or error Response
 *
 * @example
 * const partyResult = await verifyPartyOwnership(supabase, partyId, userId);
 * if (!partyResult.success) return partyResult.response;
 * const party = partyResult.value;
 */
export async function verifyPartyOwnership(
  supabase: SupabaseClient,
  partyId: number,
  userId: string,
  context?: string
): Promise<ParseResult<{ id: number; user_id: string; status: string }>> {
  const logContext = context ? ` in ${context}` : "";

  const { data: party, error: partyError } = await supabase
    .from("parties")
    .select("id, user_id, status")
    .eq("id", partyId)
    .maybeSingle();

  if (partyError) {
    logWarning(`Database error fetching party${logContext}`, {
      userId,
      partyId,
      error: partyError.message,
    });
    return {
      success: false,
      response: createErrorResponse(
        {
          code: "DATABASE_ERROR",
          message: "An unexpected error occurred",
        },
        500
      ),
    };
  }

  if (!party) {
    logWarning(`Party not found${logContext}`, { userId, partyId });
    return {
      success: false,
      response: CommonErrors.partyNotFound(),
    };
  }

  if (party.user_id !== userId) {
    logWarning(`Forbidden access attempt${logContext}`, {
      userId,
      partyId,
      ownerId: party.user_id,
    });
    return {
      success: false,
      response: CommonErrors.forbidden("You don't have permission to access this party"),
    };
  }

  return { success: true, value: party };
}

/**
 * Verifies party exists and belongs to authenticated user (for services)
 * Throws error instead of returning Response - use in service layer
 *
 * @param supabase - Supabase client instance
 * @param partyId - Party ID to verify
 * @param userId - Authenticated user ID
 * @returns Party data
 * @throws Error with code property (PARTY_NOT_FOUND, FORBIDDEN, DATABASE_ERROR)
 *
 * @example
 * const party = await verifyPartyOwnershipOrThrow(supabase, partyId, userId);
 */
export async function verifyPartyOwnershipOrThrow(
  supabase: SupabaseClient,
  partyId: number,
  userId: string
): Promise<{ id: number; user_id: string; status: string; [key: string]: unknown }> {
  const { data: party, error: partyError } = await supabase.from("parties").select("*").eq("id", partyId).maybeSingle();

  if (partyError) {
    logError("Database error fetching party", {
      userId,
      partyId,
      error: partyError.message,
    });
    throw new Error(`Database error: ${partyError.message}`);
  }

  if (!party) {
    logInfo("Party not found", { userId, partyId });
    throw new Error("PARTY_NOT_FOUND");
  }

  if (party.user_id !== userId) {
    logInfo("Unauthorized party access attempt", {
      userId,
      partyId,
      actualOwnerId: party.user_id,
    });
    throw new Error("PARTY_NOT_FOUND"); // Security: don't reveal party exists
  }

  return party;
}

// ============================================================================
// Error Response Helpers
// ============================================================================

/**
 * Creates a standardized JSON error response
 *
 * @param error - Error object with code and message
 * @param status - HTTP status code
 * @param details - Optional additional error details
 * @returns Response object with JSON error body
 *
 * @example
 * return createErrorResponse(
 *   { code: "NOT_FOUND", message: "Resource not found" },
 *   404
 * );
 */
export function createErrorResponse(
  error: { code: string; message: string },
  status: number,
  details?: Record<string, unknown>
): Response {
  const body: APIError = {
    error: {
      code: error.code,
      message: error.message,
      ...(details && { details }),
    },
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Creates error response for any throwable error with code and status
 *
 * @param error - Error object with optional code and status properties
 * @returns Response object or null if error doesn't have required properties
 */
export function createErrorResponseFromThrown(error: Error & { code?: string; status?: number }): Response | null {
  if (error.status && error.code) {
    return createErrorResponse({ code: error.code, message: error.message }, error.status);
  }
  return null;
}

/**
 * Creates error response from Zod validation errors
 *
 * @param zodError - Zod validation error object
 * @param message - Custom error message (default: "Invalid request body")
 * @returns Response object with formatted validation errors
 *
 * @example
 * const validation = MySchema.safeParse(data);
 * if (!validation.success) {
 *   return createValidationErrorResponse(validation.error);
 * }
 */
export function createValidationErrorResponse(
  zodError: { errors: { path: (string | number)[]; message: string }[] },
  message = "Invalid request body"
): Response {
  logWarning("Request validation failed", { errors: zodError.errors });

  const errors = zodError.errors.map((err) => ({
    field: err.path.join("."),
    message: err.message,
  }));

  return createErrorResponse(
    {
      code: "VALIDATION_ERROR",
      message,
    },
    400,
    { errors }
  );
}

// ============================================================================
// Common Error Responses
// ============================================================================

/**
 * Standard error responses that can be reused across endpoints
 */
export const CommonErrors = {
  /**
   * 401 - Unauthorized (missing or invalid authentication)
   */
  unauthorized(message = "Missing or invalid authentication token"): Response {
    return createErrorResponse(
      {
        code: "UNAUTHORIZED",
        message,
      },
      401
    );
  },
  /**
   * 500 - Database error
   */
  databaseError(message = "Database error. Please try again later."): Response {
    return createErrorResponse(
      {
        code: "DATABASE_ERROR",
        message,
      },
      500
    );
  },
  /**
   * 500 - Internal server error when Supabase client is unavailable
   */
  supabaseUnavailable(): Response {
    return createErrorResponse(
      {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred. Please try again later.",
      },
      500
    );
  },

  /**
   * 404 - Party not found
   */
  partyNotFound(): Response {
    return createErrorResponse(
      {
        code: "PARTY_NOT_FOUND",
        message: "Party not found",
      },
      404
    );
  },

  /**
   * 404 - Drink not found
   */
  drinkNotFound(): Response {
    return createErrorResponse(
      {
        code: "DRINK_NOT_FOUND",
        message: "Drink not found",
      },
      404
    );
  },

  /**
   * 403 - Forbidden access to resource
   */
  forbidden(message = "You don't have permission to access this resource"): Response {
    return createErrorResponse(
      {
        code: "FORBIDDEN",
        message,
      },
      403
    );
  },

  /**
   * 422 - Party is closed
   */
  partyClosed(action = "perform this action"): Response {
    return createErrorResponse(
      {
        code: "PARTY_CLOSED",
        message: `Cannot ${action} on a closed party`,
      },
      422
    );
  },

  /**
   * 409 - Conflict (generic)
   */
  conflict(message: string): Response {
    return createErrorResponse(
      {
        code: "CONFLICT",
        message,
      },
      409
    );
  },

  /**
   * 500 - Generic internal server error
   */
  internalError(message = "An unexpected error occurred. Please try again later."): Response {
    return createErrorResponse(
      {
        code: "INTERNAL_SERVER_ERROR",
        message,
      },
      500
    );
  },
};

// ============================================================================
// Success Response Helpers
// ============================================================================

/**
 * Creates a standardized JSON success response
 *
 * @param data - Response data
 * @param status - HTTP status code (default: 200)
 * @returns Response object with JSON body
 *
 * @example
 * return createSuccessResponse(partyDTO, 201);
 */
export function createSuccessResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
