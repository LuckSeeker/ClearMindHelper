import React from "react";
import type { AlertDTO } from "../types";

interface AlertsPanelProps {
  alerts: AlertDTO[];
}

function AlertsPanelComponent({ alerts }: AlertsPanelProps) {
  // Debug: log przekazywane alerty
  console.log("[AlertsPanel] alerts:", alerts);
  if (!alerts || alerts.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 mt-2" aria-live="polite">
      {alerts.map((alert) => (
        <div key={alert.id} className="flex items-center gap-2 p-2 rounded bg-yellow-100 text-yellow-900">
          <span className="font-bold">{alert.alert_type}</span>
          <span className="text-xs">BAC: {alert.bac_at_alert?.toFixed(3)}‰</span>
          <span className="text-xs">o {new Date(alert.triggered_at).toLocaleTimeString()}</span>
        </div>
      ))}
    </div>
  );
}

const AlertsPanel = React.memo(AlertsPanelComponent);
AlertsPanel.displayName = "AlertsPanel";

export default AlertsPanel;
