/**
 * Drink Validation Schemas
 *
 * Zod schemas for validating drink-related data.
 * Ensures data integrity before database operations.
 */

import { z } from "zod";

/**
 * Schema for validating query parameters for GET /parties/:id/drinks
 * Handles multiple boolean formats: 'true', '1', true, etc.
 */
export const PartyDrinksQueryParamsSchema = z.object({
  include_bac: z
    .union([z.string(), z.boolean(), z.null()])
    .nullable()
    .optional()
    .default(true)
    .transform((val) => {
      if (val === null || val === undefined) return true;
      if (typeof val === "boolean") return val;
      // Parse string to boolean
      const lower = String(val).toLowerCase();
      return lower === "true" || lower === "1" || lower === "yes";
    }),
});

/**
 * Schema for adding a new drink to a party
 *
 * Validates:
 * - volume_ml: Positive number, max 5000ml (business constraint)
 * - abv_percent: Positive number between 0 and 100
 * - consumed_at: Optional ISO 8601 datetime string (defaults to current time)
 * - confirm_warnings: Optional boolean to confirm validation warnings
 */
export const AddDrinkSchema = z.object({
  volume_ml: z
    .number({
      required_error: "volume_ml is required",
      invalid_type_error: "volume_ml must be a number",
    })
    .positive({
      message: "volume_ml must be greater than 0",
    })
    .max(5000, {
      message: "volume_ml cannot exceed 5000ml",
    }),

  abv_percent: z
    .number({
      required_error: "abv_percent is required",
      invalid_type_error: "abv_percent must be a number",
    })
    .min(0, {
      message: "abv_percent cannot be negative",
    })
    .max(100, {
      message: "abv_percent cannot exceed 100",
    }),

  consumed_at: z
    .string({
      invalid_type_error: "consumed_at must be a string",
    })
    .datetime({
      message: "consumed_at must be a valid ISO 8601 datetime string",
    })
    .optional(),

  confirm_warnings: z
    .boolean({
      invalid_type_error: "confirm_warnings must be a boolean",
    })
    .optional(),
});

/**
 * Schema for updating the last drink in a party
 *
 * Validates:
 * - volume_ml: Positive number, max 5000ml
 * - abv_percent: Positive number between 0 and 100
 */
export const UpdateDrinkSchema = z.object({
  volume_ml: z
    .number({
      required_error: "volume_ml is required",
      invalid_type_error: "volume_ml must be a number",
    })
    .positive({
      message: "volume_ml must be greater than 0",
    })
    .max(5000, {
      message: "volume_ml cannot exceed 5000ml",
    }),

  abv_percent: z
    .number({
      required_error: "abv_percent is required",
      invalid_type_error: "abv_percent must be a number",
    })
    .min(0, {
      message: "abv_percent cannot be negative",
    })
    .max(100, {
      message: "abv_percent cannot exceed 100",
    }),
});

/**
 * Type exports for use in service layer
 */
export type AddDrinkInput = z.infer<typeof AddDrinkSchema>;
export type UpdateDrinkInput = z.infer<typeof UpdateDrinkSchema>;
