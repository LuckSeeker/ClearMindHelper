import type { APIRoute } from "astro";
import { updateThresholdSchema } from "../../../lib/validation/threshold.validation";
import {
  updateUserThreshold,
  getCurrentThreshold,
  createDefaultThreshold,
} from "../../../lib/services/threshold.service";
import { updateAlertsAfterThresholdChange } from "../../../lib/services/alert.service";
import type { UserThresholdDTO, APIError, CurrentThresholdResponseDTO } from "../../../types";
import { logError, logInfo } from "../../../lib/logger";
import {
  getAuthenticatedUserId,
  validateSupabaseClient,
  createValidationErrorResponse,
  CommonErrors,
} from "../../../lib/api-helpers";

export const prerender = false;

export const PUT: APIRoute = async ({ request, locals }) => {
  // 1. Validate Supabase client
  const supabaseResult = validateSupabaseClient(locals.supabase);
  if (!supabaseResult.success) return supabaseResult.response;
  const supabase = supabaseResult.value;

  // 2. Autoryzacja
  const userIdResult = getAuthenticatedUserId();
  if (!userIdResult.success) return userIdResult.response;
  const user_id = userIdResult.value;

  // 3. Walidacja danych wejściowych
  const body = await request.json();
  const validationResult = updateThresholdSchema.safeParse(body);
  if (!validationResult.success) {
    return createValidationErrorResponse(validationResult.error, "Invalid input");
  }
  const input = validationResult.data;

  // 4. Wywołanie logiki biznesowej
  try {
    const threshold: UserThresholdDTO | APIError = await updateUserThreshold(user_id, input.threshold_bac, supabase);
    if ("error" in threshold) {
      if (threshold.error.code === "NOT_FOUND") {
        return new Response(JSON.stringify(threshold), { status: 404 });
      }
      return new Response(JSON.stringify(threshold), { status: 400 });
    }
    // Aktualizuj alerty po zmianie progu
    await updateAlertsAfterThresholdChange(supabase, user_id);
    return new Response(JSON.stringify(threshold), { status: 200 });
  } catch (err) {
    logError("PUT /api/thresholds/current", err);
    return CommonErrors.internalError();
  }
};

export const GET: APIRoute = async ({ locals }) => {
  // 1. Validate Supabase client
  const supabaseResult = validateSupabaseClient(locals.supabase);
  if (!supabaseResult.success) return supabaseResult.response;
  const supabase = supabaseResult.value;

  // 2. Get authenticated user ID
  const userIdResult = getAuthenticatedUserId();
  if (!userIdResult.success) return userIdResult.response;
  const userId = userIdResult.value;

  try {
    // 3. Fetch current threshold
    let threshold = await getCurrentThreshold(userId, supabase);

    // 4. If not found, create default threshold
    if (!threshold) {
      logInfo("No threshold found for user, creating default", { userId });
      threshold = await createDefaultThreshold(userId, supabase);
    }

    // 5. Map to DTO
    const responseDTO: CurrentThresholdResponseDTO = {
      id: threshold.id,
      user_id: threshold.user_id,
      threshold_bac: threshold.threshold_bac,
      is_current: Boolean(threshold.is_current),
      reason: threshold.reason,
      trigger_party_id: threshold.trigger_party_id,
      created_at: threshold.created_at ?? new Date().toISOString(),
    };

    // 6. Return success response
    return new Response(JSON.stringify(responseDTO), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    logError("Failed to get current threshold", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return CommonErrors.internalError();
  }
};
