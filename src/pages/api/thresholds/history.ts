import type { APIRoute } from "astro";
import { getThresholdHistory } from "../../../lib/services/threshold.service";
import type { ThresholdHistoryResponseDTO } from "../../../types";
import {
  getUserIdFromSupabase,
  validateSupabaseClient,
  createValidationErrorResponse,
  createSuccessResponse,
  CommonErrors,
} from "../../../lib/api-helpers";
import { logError } from "../../../lib/logger";
import { PaginationQuerySchema } from "../../../lib/validation/pagination.validation";

export const prerender = false;

export const GET: APIRoute = async ({ locals, request }) => {
  // 1. Validate Supabase client
  const supabaseResult = validateSupabaseClient(locals.supabase);
  if (!supabaseResult.success) return supabaseResult.response;
  const supabase = supabaseResult.value;

  // 2. Get authenticated user ID
  const userIdResult = await getUserIdFromSupabase(locals.supabase);
  if (!userIdResult.success) return userIdResult.response;
  const userId = userIdResult.value;

  // 3. Validate query params (universal pagination schema)
  const searchParams = request.url ? new URL(request.url).searchParams : undefined;
  const queryParams = {
    page: searchParams?.get("page") ?? undefined,
    limit: searchParams?.get("limit") ?? undefined,
  };
  const validationResult = PaginationQuerySchema.safeParse(queryParams);
  if (!validationResult.success) {
    return createValidationErrorResponse(validationResult.error, "Invalid query parameters");
  }
  const { page, limit } = validationResult.data;

  try {
    // 4. Call service to get paginated threshold history
    const result: ThresholdHistoryResponseDTO = await getThresholdHistory(userId, page, limit, supabase);
    return createSuccessResponse(result, 200);
  } catch (err) {
    logError("Failed to get threshold history", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return CommonErrors.internalError();
  }
};
