import { useReducer } from "react";
import type {
  PartyDetailDTO,
  DrinkDTO,
  CurrentBACResponseDTO,
  AlertDTO,
  APIError,
  DrinkValidationWarning,
  ClosePartyCommand,
} from "../../types";
import { DEFAULT_USER_ID } from "../../db/supabase.client";
import { DEFAULT_THRESHOLD_BAC } from "../../lib/constants";
import { logError } from "../../lib/logger";
import React from "react";

// Typy i reducer muszą być zadeklarowane przed użyciem w useReducer
interface State {
  party: PartyDetailDTO | null;
  drinks: DrinkDTO[];
  currentBAC: CurrentBACResponseDTO | null;
  alerts: AlertDTO[];
  error: APIError | null;
  warning: DrinkValidationWarning | null;
  loading: boolean;
}

type Action =
  | { type: "SET_PARTY"; payload: PartyDetailDTO | null }
  | { type: "SET_DRINKS"; payload: DrinkDTO[] }
  | { type: "SET_BAC"; payload: CurrentBACResponseDTO | null }
  | { type: "SET_ALERTS"; payload: AlertDTO[] }
  | { type: "SET_ERROR"; payload: APIError | null }
  | { type: "SET_WARNING"; payload: DrinkValidationWarning | null }
  | { type: "SET_LOADING"; payload: boolean };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_PARTY":
      return { ...state, party: action.payload };
    case "SET_DRINKS":
      return { ...state, drinks: action.payload };
    case "SET_BAC":
      return { ...state, currentBAC: action.payload };
    case "SET_ALERTS":
      return { ...state, alerts: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_WARNING":
      return { ...state, warning: action.payload };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    default:
      return state;
  }
}

export function useParty() {
  const [state, dispatch] = useReducer(reducer, {
    party: null,
    drinks: [],
    currentBAC: null,
    alerts: [],
    error: null,
    warning: null,
    loading: false,
  });

  // Funkcja do pobierania szczegółów imprezy po partyId
  const refreshPartyDetails = React.useCallback(async (partyId: number) => {
    if (!partyId) return;
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const detailsRes = await fetch(`/api/parties/${partyId}`);
      if (detailsRes.ok) {
        const details = await detailsRes.json();
        dispatch({ type: "SET_PARTY", payload: details });
        dispatch({ type: "SET_DRINKS", payload: details.drinks || [] });
        dispatch({ type: "SET_ALERTS", payload: details.active_alerts || [] });
        // --- MAPOWANIE BACCalculationDTO na CurrentBACResponseDTO ---
        let bac: CurrentBACResponseDTO | null = null;
        const cbac = details.current_bac;
        // Pobierz próg z party lub domyślny
        const threshold = details.user_threshold?.threshold_bac ?? details.current_threshold ?? DEFAULT_THRESHOLD_BAC;
        if (cbac && typeof cbac === "object" && "calculated_bac" in cbac) {
          // Wyznacz status progu
          let threshold_status: "safe" | "approaching" | "exceeded" = "safe";
          if (threshold > 0) {
            if (cbac.calculated_bac >= threshold) threshold_status = "exceeded";
            else if (cbac.calculated_bac >= 0.8 * threshold) threshold_status = "approaching";
          }
          bac = {
            party_id: details.id,
            current_bac: cbac.calculated_bac ?? 0,
            calculated_at: cbac.calculation_timestamp ?? new Date().toISOString(),
            time_since_last_drink_minutes: cbac.time_since_last_drink_minutes ?? 0,
            time_since_first_drink_minutes: cbac.time_since_first_drink_minutes ?? 0,
            current_threshold: threshold,
            threshold_status,
            estimated_time_to_sober_minutes: null,
          };
        }
        dispatch({ type: "SET_BAC", payload: bac });
      }
    } catch (e) {
      logError("Błąd pobierania szczegółów imprezy (refresh)", e);
    }
    dispatch({ type: "SET_LOADING", payload: false });
  }, []);

  // Efekt inicjalizujący: pobierz aktywną imprezę i jej szczegóły
  React.useEffect(() => {
    const fetchActiveParty = async () => {
      dispatch({ type: "SET_LOADING", payload: true });
      try {
        const res = await fetch("/api/parties?status=ongoing");
        if (res.ok) {
          const result = await res.json();
          const data = result.data;
          if (Array.isArray(data) && data.length > 0) {
            await refreshPartyDetails(data[0].id);
          } else {
            // fallback: ustaw chociaż podstawowe info
            dispatch({ type: "SET_PARTY", payload: null });
            dispatch({ type: "SET_DRINKS", payload: [] });
            dispatch({ type: "SET_BAC", payload: null });
          }
        }
      } catch (e) {
        logError("Błąd pobierania aktywnej imprezy", e);
      }
      dispatch({ type: "SET_LOADING", payload: false });
    };
    fetchActiveParty();
  }, [refreshPartyDetails]);

  // Wywołanie POST /api/parties (rozpoczęcie imprezy)
  async function startParty() {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const res = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: DEFAULT_USER_ID, started_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error("Nie udało się rozpocząć imprezy");
      const party: PartyDetailDTO = await res.json();
      dispatch({ type: "SET_PARTY", payload: party });
      dispatch({ type: "SET_DRINKS", payload: party.drinks || [] });
      // Konwersja BACCalculationDTO | null do CurrentBACResponseDTO | null (jeśli API zwraca BACCalculationDTO, należy przemapować)
      let bac: CurrentBACResponseDTO | null = null;
      if (party.current_bac && typeof party.current_bac === "object" && "current_bac" in party.current_bac) {
        const cbac = party.current_bac as Partial<CurrentBACResponseDTO>;
        bac = {
          party_id: cbac.party_id ?? party.id,
          current_bac: cbac.current_bac ?? 0,
          calculated_at: cbac.calculated_at ?? new Date().toISOString(),
          time_since_last_drink_minutes: cbac.time_since_last_drink_minutes ?? 0,
          time_since_first_drink_minutes: cbac.time_since_first_drink_minutes ?? 0,
          current_threshold: cbac.current_threshold ?? 0,
          threshold_status: cbac.threshold_status ?? "safe",
          estimated_time_to_sober_minutes: cbac.estimated_time_to_sober_minutes ?? null,
        };
        //
      } else if (
        party.current_bac &&
        typeof party.current_bac === "object" &&
        "calculation_timestamp" in party.current_bac
      ) {
        // Mapowanie BACCalculationDTO na CurrentBACResponseDTO (przykład uproszczony)
        const cbac = party.current_bac as { calculated_bac?: number; calculation_timestamp?: string };
        bac = {
          party_id: party.id,
          current_bac: cbac.calculated_bac ?? 0,
          calculated_at: cbac.calculation_timestamp ?? new Date().toISOString(),
          time_since_last_drink_minutes: 0,
          time_since_first_drink_minutes: 0,
          current_threshold: 0,
          threshold_status: "safe",
          estimated_time_to_sober_minutes: null,
        };
        //
      }
      dispatch({ type: "SET_BAC", payload: bac });
      dispatch({ type: "SET_ALERTS", payload: party.active_alerts || [] });
      dispatch({ type: "SET_ERROR", payload: null });
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "message" in e
          ? ((e as { message?: string }).message ?? "Błąd uruchamiania imprezy")
          : "Błąd uruchamiania imprezy";
      dispatch({ type: "SET_ERROR", payload: { error: { code: "START_PARTY_ERROR", message } } });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }

  // Wywołanie PATCH /api/parties/[id] (zamykanie imprezy)
  async function closeParty() {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const partyId = state.party?.id;
      if (!partyId) throw new Error("Brak aktywnej imprezy");
      const command: ClosePartyCommand = { ended_at: new Date().toISOString() };
      const res = await fetch(`/api/parties/${partyId}/close`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      if (!res.ok) throw new Error("Nie udało się zamknąć imprezy");
      // Po zamknięciu imprezy można wyczyścić stan lub pobrać szczegóły zamkniętej imprezy
      dispatch({ type: "SET_PARTY", payload: null });
      dispatch({ type: "SET_DRINKS", payload: [] });
      dispatch({ type: "SET_BAC", payload: null });
      dispatch({ type: "SET_ALERTS", payload: [] });
      dispatch({ type: "SET_ERROR", payload: null });
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "message" in e
          ? ((e as { message?: string }).message ?? "Błąd zamykania imprezy")
          : "Błąd zamykania imprezy";
      dispatch({ type: "SET_ERROR", payload: { error: { code: "CLOSE_PARTY_ERROR", message } } });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }

  // Wywołanie POST /api/parties/[id]/blackout (oznaczenie blackout)
  async function markBlackout(partyId?: number) {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const id = partyId ?? state.party?.id;
      if (!id) throw new Error("Brak aktywnej imprezy");
      const res = await fetch(`/api/parties/${id}/blackout`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: DEFAULT_USER_ID }),
      });
      if (!res.ok) throw new Error("Nie udało się oznaczyć blackout");
      await res.json();
      const blackoutAlert: AlertDTO = {
        id: Date.now(),
        alert_type: "exceeded_threshold",
        bac_at_alert: 0,
        is_active: true,
        last_alert_sent_at: null,
        triggered_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        party_id: id,
        user_id: DEFAULT_USER_ID,
      };
      dispatch({ type: "SET_ALERTS", payload: [blackoutAlert] });
      dispatch({ type: "SET_ERROR", payload: null });
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "message" in e
          ? ((e as { message?: string }).message ?? "Błąd oznaczania blackout")
          : "Błąd oznaczania blackout";
      dispatch({ type: "SET_ERROR", payload: { error: { code: "BLACKOUT_ERROR", message } } });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }

  function clearWarning() {
    dispatch({ type: "SET_WARNING", payload: null });
  }

  function clearError() {
    dispatch({ type: "SET_ERROR", payload: null });
  }

  return {
    state,
    dispatch,
    startParty,
    closeParty,
    markBlackout,
    clearWarning,
    clearError,
    refreshPartyDetails,
  };
}
