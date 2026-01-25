import { useCallback } from "react";
import { useGlobalAlertsContext } from "../GlobalAlertsProvider";
import type { GlobalAlertViewModel, ToastViewModel, ModalAlertViewModel } from "../../types";

export function useGlobalAlerts() {
  const { dispatch, alerts, toasts, modal } = useGlobalAlertsContext();

  const addAlert = useCallback(
    (alert: GlobalAlertViewModel) => {
      dispatch({ type: "ADD_ALERT", alert });
    },
    [dispatch]
  );

  const removeAlert = useCallback(
    (id: number | string) => {
      dispatch({ type: "REMOVE_ALERT", id });
    },
    [dispatch]
  );

  const addToast = useCallback(
    (toast: ToastViewModel) => {
      dispatch({ type: "ADD_TOAST", toast });
    },
    [dispatch]
  );

  const removeToast = useCallback(
    (id: number | string) => {
      dispatch({ type: "REMOVE_TOAST", id });
    },
    [dispatch]
  );

  const showModal = useCallback(
    (modal: ModalAlertViewModel) => {
      dispatch({ type: "SHOW_MODAL", modal });
    },
    [dispatch]
  );

  const hideModal = useCallback(() => {
    dispatch({ type: "HIDE_MODAL" });
  }, [dispatch]);

  return {
    alerts,
    toasts,
    modal,
    addAlert,
    removeAlert,
    addToast,
    removeToast,
    showModal,
    hideModal,
  };
}
