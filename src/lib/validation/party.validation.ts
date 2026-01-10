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
 * Schema for marking blackout
 *
 * Validates:
 * - blackout_marked: Boolean flag indicating blackout status
 */
export const MarkBlackoutSchema = z.object({
  blackout_marked: z.boolean({
    required_error: "blackout_marked is required",
    invalid_type_error: "blackout_marked must be a boolean",
  }),
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
 * Type inference for MarkBlackoutSchema
 */
export type MarkBlackoutInput = z.infer<typeof MarkBlackoutSchema>;
