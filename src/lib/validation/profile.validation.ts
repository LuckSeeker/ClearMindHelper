/**
 * Profile Validation Schemas
 *
 * Zod schemas for validating user profile data.
 * Ensures data integrity before database operations.
 */

import { z } from "zod";

/**
 * Schema for updating user profile
 *
 * Validates:
 * - height_cm: 50-250 cm (realistic human height range)
 * - weight_kg: 30-300 kg (realistic human weight range)
 * - gender: Must be 'M' or 'F' (matches enum_gender in database)
 */
export const UpdateProfileSchema = z.object({
  height_cm: z
    .number({
      required_error: "Height is required",
      invalid_type_error: "Height must be a number",
    })
    .int("Height must be an integer")
    .min(50, "Height must be at least 50 cm")
    .max(250, "Height must be at most 250 cm"),

  weight_kg: z
    .number({
      required_error: "Weight is required",
      invalid_type_error: "Weight must be a number",
    })
    .min(30, "Weight must be at least 30 kg")
    .max(300, "Weight must be at most 300 kg")
    .refine((val) => {
      // Allow up to 2 decimal places
      const decimalPlaces = (val.toString().split(".")[1] || "").length;
      return decimalPlaces <= 2;
    }, "Weight can have at most 2 decimal places"),

  gender: z.enum(["M", "F"], {
    required_error: "Gender is required",
    invalid_type_error: "Gender must be 'M' or 'F'",
  }),
});

/**
 * Type inference for UpdateProfileSchema
 * Can be used for type-safe validation results
 */
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
