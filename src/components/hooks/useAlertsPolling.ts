import React, { useEffect, useRef } from "react";
import type { AlertDTO, PartyAlertsResponseDTO } from "../../types";
import { useGlobalAlertsContext } from "../GlobalAlertsProvider";

const POLL_INTERVAL = 30000; // 30s

export function useAlertsPolling(partyId: number | null) {
  const { dispatch } = useGlobalAlertsContext();
  const lastFetchedAlerts = useRef<Record<string, AlertDTO>>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Eksportuj funkcję fetchAlerts przez ref
  const fetchAlertsRef = useRef<() => Promise<void>>(null);

  const fetchAlerts = React.useCallback(async () => {
    if (!partyId) return;
    try {
      const res = await fetch(`/api/parties/${partyId}/alerts`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data: PartyAlertsResponseDTO = await res.json();
      const activeAlerts = data.active_alerts.filter((a) => a.is_active);
      // Deduplikacja po id/alert_type
      // Dodaj nowe alerty
      activeAlerts.forEach((alert) => {
        const key = `${alert.id}_${alert.alert_type}`;
        if (!lastFetchedAlerts.current[key]) {
          dispatch({
            type: "ADD_ALERT",
            alert: {
              id: alert.id,
              type: alert.alert_type === "exceeded_threshold" ? "error" : "warning",
              message:
                alert.alert_type === "exceeded_threshold" ? "Przekroczono próg BAC!" : "Zbliżasz się do progu BAC.",
              alertType: alert.alert_type,
              triggeredAt: alert.triggered_at ?? undefined,
              lastAlertSentAt: alert.last_alert_sent_at ?? undefined,
              autoClose: false,
            },
          });
          lastFetchedAlerts.current[key] = alert;
        }
      });

      // Usuń alert approaching_threshold natychmiast, gdy pojawi się exceeded_threshold
      const hasExceeded = activeAlerts.some((a) => a.alert_type === "exceeded_threshold");
      const hasApproaching = activeAlerts.some((a) => a.alert_type === "approaching_threshold");
      const updatedAlerts: Record<string, AlertDTO> = {};
      if (hasExceeded) {
        Object.entries(lastFetchedAlerts.current).forEach(([key, alert]) => {
          if (alert.alert_type === "approaching_threshold") {
            dispatch({ type: "REMOVE_ALERT", id: alert.id });
          } else {
            updatedAlerts[key] = alert;
          }
        });
      } else {
        Object.entries(lastFetchedAlerts.current).forEach(([key, alert]) => {
          if (alert.alert_type === "approaching_threshold" && !hasApproaching) {
            dispatch({ type: "REMOVE_ALERT", id: alert.id });
          } else {
            updatedAlerts[key] = alert;
          }
        });
      }
      lastFetchedAlerts.current = updatedAlerts;
    } catch (e) {
      let message = "Nieznany błąd";
      if (e instanceof Error) message = e.message;
      dispatch({
        type: "ADD_TOAST",
        toast: {
          id: `api-error-${Date.now()}`,
          message: "Błąd pobierania alertów: " + message,
          type: "error",
          autoClose: true,
        },
      });
    }
  }, [partyId, dispatch]);

  fetchAlertsRef.current = fetchAlerts;

  useEffect(() => {
    if (!partyId) return;
    fetchAlerts();
    intervalRef.current = setInterval(fetchAlerts, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [partyId, dispatch, fetchAlerts]);

  // Zwróć funkcję do wywołania z zewnątrz
  return fetchAlertsRef;
}
