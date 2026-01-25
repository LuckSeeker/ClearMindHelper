import React from "react";
import { useGlobalAlerts } from "./hooks/useGlobalAlerts";
import { InlineError } from "./InlineError";

export const AlertsPanel: React.FC = () => {
  const { alerts, removeAlert } = useGlobalAlerts();

  const hasExceeded = alerts.some((a) => a.alertType === "exceeded_threshold");
  const inlineAlerts = alerts.filter((a) => {
    if (a.type === "error") return false;
    if (a.alertType === "exceeded_threshold") return false;
    if (a.alertType === "approaching_threshold" && hasExceeded) return false;
    return true;
  });

  return (
    <div className="fixed bottom-4 left-4 z-40 flex flex-col gap-2 max-w-xs">
      {inlineAlerts.map((alert) => (
        <InlineError key={alert.id} message={alert.message} onClose={() => removeAlert(alert.id)} />
      ))}
    </div>
  );
};
