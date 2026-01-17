import { z } from "zod";

/**
 * Schema for paginated query parameters (universal for all endpoints)
 * - page: Positive integer, defaults to 1
 * - limit: Integer between 1 and 100, defaults to 20
 */
export const PaginationQuerySchema = z.object({
  page: z.coerce
    .number({ invalid_type_error: "page must be a number" })
    .int({ message: "page must be an integer" })
    .min(1, { message: "page must be greater than or equal to 1" })
    .optional()
    .default(1),
  limit: z.coerce
    .number({ invalid_type_error: "limit must be a number" })
    .int({ message: "limit must be an integer" })
    .min(1, { message: "limit must be greater than or equal to 1" })
    .max(100, { message: "limit must be less than or equal to 100" })
    .optional()
    .default(20),
});

export type PaginationQueryInput = z.infer<typeof PaginationQuerySchema>;
