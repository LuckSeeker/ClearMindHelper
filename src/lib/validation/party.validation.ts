/**
 * Party Validation Schemas
 *
 * Zod schemas for validating party-related data.
 * Ensures data integrity before database operations.
 */

import { z } from "zod";

/**
 * Schema for starting a new party
 *
 * Validates:
 * - started_at: Optional ISO 8601 datetime string
 *   If not provided, server will use current timestamp
 *   If provided, must be valid ISO format and not in future
 */
export const StartPartySchema = z.object({
  started_at: z
    .string({
      invalid_type_error: "started_at must be a string",
    })
    .datetime({
      message: "started_at must be a valid ISO 8601 datetime string",
    })
    .optional()
    .refine(
      (val) => {
        if (!val) return true; // Optional field
        const startedDate = new Date(val);
        const now = new Date();
        return startedDate <= now;
      },
      {
        message: "started_at cannot be in the future",
      }
    ),
});

/**
 * Schema for closing a party
 *
 * Validates:
 * - ended_at: Optional ISO 8601 datetime string
 *   If not provided, server will use current timestamp
 *   If provided, must be valid ISO format
 */
export const ClosePartySchema = z.object({
  ended_at: z
    .string({
      invalid_type_error: "ended_at must be a string",
    })
    .datetime({
      message: "ended_at must be a valid ISO 8601 datetime string",
    })
    .optional(),
});

/**
 * Type inference for StartPartySchema
 * Can be used for type-safe validation results
 */
export type StartPartyInput = z.infer<typeof StartPartySchema>;

/**
 * Type inference for ClosePartySchema
 */
export type ClosePartyInput = z.infer<typeof ClosePartySchema>;

/**
 * Schema for GET /api/parties query parameters
 *
 * Validates:
 * - page: Positive integer, defaults to 1
 * - limit: Integer between 1 and 100, defaults to 20
 * - status: Optional party status filter ('ongoing' | 'closed')
 * - sort: Sort column ('started_at' | 'bac_estimate_max'), defaults to 'started_at'
 * - order: Sort order ('asc' | 'desc'), defaults to 'desc'
 */
import { PaginationQuerySchema } from "./pagination.validation";

export const PartyListQuerySchema = PaginationQuerySchema.extend({
  status: z
    .enum(["ongoing", "closed"], {
      invalid_type_error: "status must be either 'ongoing' or 'closed'",
    })
    .optional(),
  sort: z
    .enum(["started_at", "bac_estimate_max"], {
      invalid_type_error: "sort must be either 'started_at' or 'bac_estimate_max'",
    })
    .optional()
    .default("started_at"),
  order: z
    .enum(["asc", "desc"], {
      invalid_type_error: "order must be either 'asc' or 'desc'",
    })
    .optional()
    .default("desc"),
});

/**
 * Type inference for PartyListQuerySchema
 */
export type PartyListQueryInput = z.infer<typeof PartyListQuerySchema>;

/**
 * Schema for validating party ID parameter
 *
 * Validates:
 * - id: Must be a positive integer (coerced from string)
 *   Used for validating URL path parameters like /api/parties/:id
 */
export const PartyIdParamSchema = z.object({
  id: z.coerce
    .number({
      invalid_type_error: "id must be a number",
    })
    .int({
      message: "id must be an integer",
    })
    .positive({
      message: "id must be a positive number",
    }),
});

/**
 * Type inference for PartyIdParamSchema
 */
export type PartyIdParamInput = z.infer<typeof PartyIdParamSchema>;
