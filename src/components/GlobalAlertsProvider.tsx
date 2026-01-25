import React, { createContext, useReducer, useContext } from "react";
import type { ReactNode, Dispatch } from "react";
import type { GlobalAlertViewModel, ToastViewModel, ModalAlertViewModel } from "../types";
import { ToastContainer } from "./ToastContainer";
import { AlertModal } from "./AlertModal";
import { AlertsPanel } from "./AlertsPanel";

interface GlobalAlertsState {
  alerts: GlobalAlertViewModel[];
  toasts: ToastViewModel[];
  modal: ModalAlertViewModel | null;
}

type GlobalAlertsAction =
  | { type: "ADD_ALERT"; alert: GlobalAlertViewModel }
  | { type: "REMOVE_ALERT"; id: number | string }
  | { type: "ADD_TOAST"; toast: ToastViewModel }
  | { type: "REMOVE_TOAST"; id: number | string }
  | { type: "SHOW_MODAL"; modal: ModalAlertViewModel }
  | { type: "HIDE_MODAL" }
  | { type: "RESET" };

const initialState: GlobalAlertsState = {
  alerts: [],
  toasts: [],
  modal: null,
};

function globalAlertsReducer(state: GlobalAlertsState, action: GlobalAlertsAction): GlobalAlertsState {
  switch (action.type) {
    case "ADD_ALERT": {
      // Deduplikacja po id/alertType
      if (state.alerts.some((a) => a.id === action.alert.id && a.alertType === action.alert.alertType)) {
        return state;
      }
      // Jeśli dodajemy exceeded_threshold, usuwamy wszystkie approaching_threshold
      if (action.alert.alertType === "exceeded_threshold") {
        return {
          ...state,
          alerts: [
            ...state.alerts.filter(
              (a) => a.alertType !== "approaching_threshold" && a.alertType !== "exceeded_threshold"
            ),
            action.alert,
          ],
        };
      }
      // Jeśli już jest exceeded_threshold, nie dodawaj approaching_threshold
      if (
        action.alert.alertType === "approaching_threshold" &&
        state.alerts.some((a) => a.alertType === "exceeded_threshold")
      ) {
        return state;
      }
      // Jeśli już jest approaching_threshold, zamień na nowy (zawsze tylko jeden taki alert)
      if (action.alert.alertType === "approaching_threshold") {
        return {
          ...state,
          alerts: [...state.alerts.filter((a) => a.alertType !== "approaching_threshold"), action.alert],
        };
      }
      // Domyślnie dodaj alert
      return { ...state, alerts: [...state.alerts, action.alert] };
    }
    case "REMOVE_ALERT":
      return { ...state, alerts: state.alerts.filter((a) => a.id !== action.id) };
    case "ADD_TOAST":
      if (state.toasts.some((t) => t.id === action.toast.id)) {
        return state;
      }
      return { ...state, toasts: [...state.toasts, action.toast] };
    case "REMOVE_TOAST":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    case "SHOW_MODAL":
      return { ...state, modal: action.modal };
    case "HIDE_MODAL":
      return { ...state, modal: null };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

interface GlobalAlertsContextValue extends GlobalAlertsState {
  dispatch: Dispatch<GlobalAlertsAction>;
}

const GlobalAlertsContext = createContext<GlobalAlertsContextValue | undefined>(undefined);

export const GlobalAlertsProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(globalAlertsReducer, initialState);
  // Jeśli pojawi się exceeded_threshold, nie pokazuj approaching_threshold (logika w reduktorze)
  const hasExceeded = state.alerts.some((a) => a.alertType === "exceeded_threshold");
  const hasApproaching = state.alerts.some((a) => a.alertType === "approaching_threshold");

  // Wyświetlaj modal tylko dla alertów typu exceeded_threshold
  const exceededAlert = state.alerts.find((a) => a.alertType === "exceeded_threshold");
  const modal = exceededAlert
    ? {
        id: exceededAlert.id,
        title: "Przekroczono próg BAC!",
        message: exceededAlert.message,
        actions: exceededAlert.actions,
      }
    : null;

  // Wyświetlaj toast tylko dla approaching_threshold i błędów API (już obsługiwane przez toasts)

  // Obsługa zamykania toastów i modala
  const handleToastClose = (id: number | string) => {
    dispatch({ type: "REMOVE_TOAST", id });
  };
  const handleModalClose = () => {
    dispatch({ type: "HIDE_MODAL" });
    // Usuwamy alert exceeded_threshold po zamknięciu modala
    if (exceededAlert) {
      dispatch({ type: "REMOVE_ALERT", id: exceededAlert.id });
      // Zapisz czas zamknięcia alertu exceeded_threshold do sessionStorage
      sessionStorage.setItem("exceeded_threshold_closed_at", Date.now().toString());
    }
  };

  // Usuń toast jeśli nie ma approaching_threshold lub jest exceeded_threshold
  const filteredToasts =
    hasApproaching && !hasExceeded
      ? state.toasts
      : state.toasts.filter((t) => t.message !== "Zbliżasz się do progu BAC.");

  return (
    <GlobalAlertsContext.Provider value={{ ...state, dispatch }}>
      <ToastContainer toasts={filteredToasts} onClose={handleToastClose} />
      <AlertModal alert={modal} onClose={handleModalClose} />
      <AlertsPanel />
      {children}
    </GlobalAlertsContext.Provider>
  );
};

export function useGlobalAlertsContext() {
  const ctx = useContext(GlobalAlertsContext);
  if (!ctx) throw new Error("useGlobalAlertsContext must be used within GlobalAlertsProvider");
  return ctx;
}
