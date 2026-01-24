import React, { useState } from "react";

import PartyStartButton from "./PartyStartButton.tsx";
import PartyHeader from "./PartyHeader.tsx";
import DrinksTable from "./DrinksTable.tsx";
import ClosePartyButton from "./ClosePartyButton.tsx";
import BlackoutModal from "./BlackoutModal.tsx";
import WarningModal from "./WarningModal.tsx";
import AddEditDrinkModal from "./AddEditDrinkModal.tsx";
import { useParty } from "./hooks/useParty";

import type { DrinkWithBACDTO, DrinkDTO, UserThresholdDTO, PartyDetailDTO } from "../types";
import type { AddDrinkFormModel } from "./AddEditDrinkModal";
import { logError } from "@/lib/logger.ts";
import { getCurrentThreshold } from "../lib/services/threshold.service";
import { supabaseClient, DEFAULT_USER_ID } from "../db/supabase.client";
import { DEFAULT_THRESHOLD_BAC } from "../lib/constants";
import { WIDMARK_CONSTANTS } from "../lib/constants";

const PartyView: React.FC = () => {
  // Stan na ostatnio zamkniętą imprezę (do modala blackout)
  const [lastClosedParty, setLastClosedParty] = useState<PartyDetailDTO | null>(null);
  // Przykładowo partyId może być pobierane z props, routera lub kontekstu
  // const partyId = undefined; // TODO: podłącz partyId z routera/kontekstu

  const partyApi = useParty();
  const { party, drinks, currentBAC, alerts, warning, error, loading } = partyApi.state;

  // Modal blackout otwierany tylko po kliknięciu przycisku zamknij imprezę
  // Filtrowanie alertów: jeśli jest 'exceeded_threshold', nie pokazuj 'approaching_threshold'
  const filteredAlerts = React.useMemo(() => {
    if (!alerts || alerts.length === 0) return [];
    const hasExceeded = alerts.some((a) => a.alert_type === "exceeded_threshold");
    if (hasExceeded) {
      return alerts.filter((a) => a.alert_type === "exceeded_threshold");
    }
    return alerts;
  }, [alerts]);

  // Stan na aktualny próg użytkownika
  const [userThreshold, setUserThreshold] = React.useState<UserThresholdDTO | null>(null);
  React.useEffect(() => {
    async function fetchThreshold() {
      try {
        const threshold = await getCurrentThreshold(DEFAULT_USER_ID, supabaseClient);
        setUserThreshold(threshold);
      } catch (e) {
        logError("Błąd pobierania progu użytkownika", e);
      }
    }
    fetchThreshold();
  }, []);

  // Map backend BACCalculationDTO to CurrentBACResponseDTO for BACIndicator
  let headerBAC = currentBAC;
  if (!headerBAC && party && party.current_bac) {
    const bac = party.current_bac;
    headerBAC = {
      party_id: party.id,
      current_bac: typeof bac.calculated_bac === "number" ? bac.calculated_bac : 0,
      calculated_at: bac.calculation_timestamp || new Date().toISOString(),
      time_since_last_drink_minutes: 0, // Not available in BACCalculationDTO
      time_since_first_drink_minutes: 0, // Not available in BACCalculationDTO
      current_threshold: userThreshold?.threshold_bac ?? DEFAULT_THRESHOLD_BAC,
      threshold_status: (() => {
        const bacValue = typeof bac.calculated_bac === "number" ? bac.calculated_bac : 0;
        const threshold = userThreshold?.threshold_bac ?? DEFAULT_THRESHOLD_BAC;
        if (threshold === 0) return "safe";
        if (bacValue >= threshold) return "exceeded";
        if (bacValue >= WIDMARK_CONSTANTS.APPROACHING_THRESHOLD_RATIO * threshold) return "approaching";
        return "safe";
      })(),
      estimated_time_to_sober_minutes: null,
    };
  }
  const { startParty, closeParty: closePartyOrig, markBlackout, clearError } = partyApi;

  // Blackout modal state
  const [blackoutModalOpen, setBlackoutModalOpen] = useState(false);

  // Owijka na closeParty, która otwiera modal blackout
  const handleCloseParty = async () => {
    if (party) setLastClosedParty(party); // zapisz party przed zamknięciem
    await closePartyOrig();
    setBlackoutModalOpen(true);
  };

  // Modal state: open/close and selected drink for edit
  const [drinkModalOpen, setDrinkModalOpen] = useState(false);
  const [editingDrink, setEditingDrink] = useState<DrinkDTO | null>(null);
  const [pendingDrink, setPendingDrink] = useState<AddDrinkFormModel | null>(null);

  // Handlers for opening/closing Add/Edit Drink modal

  const handleAddDrink = () => {
    if (!party) return;
    const now = new Date();
    const partyStart = new Date(party.started_at);
    const defaultDate = now > partyStart ? now : partyStart;
    // Ustaw domyślny czas w lokalnej strefie (input type="datetime-local" oczekuje lokalnego czasu)
    const pad = (n: number) => n.toString().padStart(2, "0");
    const yyyy = defaultDate.getFullYear();
    const mm = pad(defaultDate.getMonth() + 1);
    const dd = pad(defaultDate.getDate());
    const hh = pad(defaultDate.getHours());
    const min = pad(defaultDate.getMinutes());
    const consumed_at = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    setEditingDrink(null);
    setPendingDrink({ volume_ml: "", abv_percent: "", consumed_at, errors: {}, isEditing: false });
    setDrinkModalOpen(true);
  };

  const handleEditDrink = (drinkId: number) => {
    const drink = drinks.find((d) => d.id === drinkId) || null;
    setEditingDrink(drink);
    setDrinkModalOpen(true);
  };

  // Dodawanie lub edycja drinka
  const handleDrinkSubmit = async (values: AddDrinkFormModel, confirmWarnings = false) => {
    if (!party) return;
    // Walidacja frontendowa
    if (
      values.volume_ml === "" ||
      isNaN(Number(values.volume_ml)) ||
      Number(values.volume_ml) <= 0 ||
      Number(values.volume_ml) > 5000 ||
      values.abv_percent === "" ||
      isNaN(Number(values.abv_percent)) ||
      Number(values.abv_percent) < 0 ||
      Number(values.abv_percent) > 100
    ) {
      partyApi.dispatch({
        type: "SET_ERROR",
        payload: { error: { code: "DRINK_VALIDATION", message: "Uzupełnij poprawnie wszystkie pola napoju." } },
      });
      return;
    }

    // Format consumed_at to ISO 8601 with seconds and Z (UTC)
    const toIso8601WithSeconds = (input: string) => {
      if (!input) return undefined;
      // Uzupełnij brakujące sekundy jeśli trzeba
      let iso = input;
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input)) {
        iso = input + ":00";
      }
      // Jeśli nie ma Z na końcu, traktuj jako lokalny i konwertuj do UTC
      if (!iso.endsWith("Z")) {
        const date = new Date(iso);
        return date.toISOString();
      }
      // Jeśli już jest Z, zwróć bez zmian
      return iso;
    };

    const submitDrink = async (drink: AddDrinkFormModel, confirmWarnings: boolean) => {
      try {
        const isEdit = !!editingDrink;
        if (!party) return;
        const endpoint = isEdit
          ? `/api/parties/${party.id}/drinks/${editingDrink?.id}`
          : `/api/parties/${party.id}/drinks`;
        const method = isEdit ? "PUT" : "POST";
        const volume_ml = Number(drink.volume_ml);
        const abv_percent = Number(drink.abv_percent);
        const body = {
          volume_ml,
          abv_percent,
          consumed_at: toIso8601WithSeconds(drink.consumed_at),
          ...(confirmWarnings ? { confirm_warnings: true } : {}),
        };
        const res = await fetch(endpoint, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const error = await res.json();
          partyApi.dispatch({
            type: "SET_ERROR",
            payload: { error: { code: "DRINK_ERROR", message: error?.message || "Błąd zapisu napoju" } },
          });
          return;
        }
        const data = await res.json();
        if (data.warnings && data.warnings.length > 0) {
          setPendingDrink(drink);
          partyApi.dispatch({ type: "SET_WARNING", payload: data.warnings[0] });
        } else {
          // Po udanym dodaniu/edycji drinka natychmiast odśwież szczegóły imprezy
          if (party?.id) await partyApi.refreshPartyDetails(party.id);
          partyApi.dispatch({ type: "SET_WARNING", payload: null });
          setPendingDrink(null);
          setDrinkModalOpen(false);
          setEditingDrink(null);
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Błąd zapisu napoju";
        partyApi.dispatch({
          type: "SET_ERROR",
          payload: { error: { code: "DRINK_ERROR", message: errMsg } },
        });
      }
    };

    // Pierwsza próba bez confirm_warnings lub z potwierdzeniem
    await submitDrink(values, confirmWarnings);
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto p-4">
      {loading && (
        <div className="flex justify-center items-center h-32">
          <span className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neutral-800 mr-2" />
          <span>Ładowanie...</span>
        </div>
      )}
      {error && (
        <div className="bg-red-100 text-red-800 p-2 rounded mb-2 flex justify-between items-center">
          <span>{error.error?.message || "Wystąpił błąd"}</span>
          <button className="ml-4 text-xs underline" onClick={clearError} aria-label="Zamknij komunikat błędu">
            Zamknij
          </button>
        </div>
      )}
      {/* startParty, closeParty, markBlackout muszą być zaimplementowane w hooku useParty i zwracane, jeśli mają być używane */}
      {party && !loading ? (
        <>
          <PartyHeader party={party} currentBAC={currentBAC} alerts={filteredAlerts} />
          <DrinksTable
            drinks={drinks as DrinkWithBACDTO[]}
            party={party}
            onAdd={handleAddDrink}
            onEdit={handleEditDrink}
          />
          <AddEditDrinkModal
            open={drinkModalOpen}
            onClose={() => {
              setDrinkModalOpen(false);
              setPendingDrink(null);
              setEditingDrink(null);
            }}
            onSubmit={handleDrinkSubmit}
            initialValues={pendingDrink || undefined}
            isEditing={!!editingDrink}
            warning={warning?.message}
          />
          <div className="flex gap-2 mt-4">
            <ClosePartyButton party={party} onClose={handleCloseParty} />
          </div>
          {/* BACIndicator jest renderowany w PartyHeader */}
          <AddEditDrinkModal
            open={drinkModalOpen}
            onClose={() => {
              setDrinkModalOpen(false);
              setEditingDrink(null);
            }}
            onSubmit={handleDrinkSubmit}
            initialValues={
              editingDrink
                ? {
                    volume_ml: editingDrink.volume_ml,
                    abv_percent: editingDrink.abv_percent,
                    consumed_at: (() => {
                      const d = new Date(editingDrink.consumed_at);
                      const pad = (n: number) => n.toString().padStart(2, "0");
                      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                    })(),
                    errors: {},
                    isEditing: true,
                    drinkId: editingDrink.id,
                  }
                : undefined
            }
            isEditing={!!editingDrink}
          />
        </>
      ) : (
        !loading && <PartyStartButton onStart={startParty} />
      )}

      {/* BlackoutModal renderowany niezależnie od party */}
      <BlackoutModal
        party={lastClosedParty}
        open={blackoutModalOpen}
        onConfirm={async () => {
          await markBlackout(lastClosedParty?.id);
          setBlackoutModalOpen(false);
          setLastClosedParty(null);
        }}
        onCancel={() => {
          setBlackoutModalOpen(false);
          setLastClosedParty(null);
        }}
      />
      <WarningModal
        warning={warning}
        onConfirm={async () => {
          if (pendingDrink) {
            await handleDrinkSubmit({ ...pendingDrink }, true);
            if (party?.id) await partyApi.refreshPartyDetails(party.id);
            setPendingDrink(null);
            setDrinkModalOpen(false);
            setEditingDrink(null);
            partyApi.dispatch({ type: "SET_WARNING", payload: null });
          }
        }}
        onCancel={() => {
          setPendingDrink(null);
          setDrinkModalOpen(false);
          setEditingDrink(null);
        }}
      />
    </div>
  );
};
export default PartyView;
