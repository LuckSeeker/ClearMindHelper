/**
 * API Helper Functions
 *
 * Reusable utilities for API endpoint handlers including:
 * - Parameter validation and parsing
 * - Standardized error response creation
 * - Common request/response patterns
 */

import type { APIError } from "../types";
import { logWarning } from "./logger";

// ============================================================================
// Parameter Validation Helpers
// ============================================================================

/**
 * Result of parameter parsing - either success with value or error response
 */
export type ParseResult<T> = { success: true; value: T } | { success: false; response: Response };

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
