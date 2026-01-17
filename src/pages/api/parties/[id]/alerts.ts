import type { APIRoute } from "astro";
import { getActiveAlertsForParty } from "../../../../lib/services/alert.service";
import { logError } from "../../../../lib/logger";
import type { PartyAlertsResponseDTO } from "../../../../types";
import {
  parsePositiveIntParam,
  validateSupabaseClient,
  CommonErrors,
  createSuccessResponse,
} from "../../../../lib/api-helpers";
import { DEFAULT_USER_ID } from "../../../../db/supabase.client";

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  // 1. Walidacja klienta supabase
  const supabaseResult = validateSupabaseClient(locals.supabase);
  if (!supabaseResult.success) return supabaseResult.response;
  const supabase = supabaseResult.value;

  // DEVELOPMENT MODE: Użyj DEFAULT_USER_ID
  // TODO: Zastąpić prawdziwą autoryzacją JWT
  const userId = DEFAULT_USER_ID;

  try {
    // 2. Walidacja partyId analogicznie do drinks.ts
    const partyIdResult = parsePositiveIntParam(params.id, "partyId");
    if (!partyIdResult.success) {
      logError("Invalid partyId in GET alerts", partyIdResult.response);
      return partyIdResult.response;
    }
    const partyId = partyIdResult.value;

    // 3. Pobranie aktywnych alertów
    const result = await getActiveAlertsForParty(supabase, userId, partyId);
    if (result.error) {
      if (result.error === "not_found") {
        return CommonErrors.partyNotFound();
      }
      if (result.error === "forbidden") {
        return CommonErrors.forbidden();
      }
      logError("Error fetching alerts", result.error, { userId, partyId });
      return CommonErrors.internalError();
    }

    // 4. Sukces
    const response: PartyAlertsResponseDTO = {
      party_id: Number(partyId),
      active_alerts: result.alerts ?? [],
    };
    return createSuccessResponse(response);
  } catch (err) {
    logError("Unexpected error in GET /api/parties/[id]/alerts", err, { userId, params });
    return CommonErrors.internalError();
  }
};
