import React from "react";
import type { CurrentBACResponseDTO } from "../types";

interface BACIndicatorProps {
  currentBAC: CurrentBACResponseDTO;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "exceeded":
      return "bg-red-500";
    case "approaching":
      return "bg-orange-400"; // bardziej pomarańczowy
    case "safe":
    default:
      return "bg-green-500";
  }
};

function BACIndicatorComponent({ currentBAC }: BACIndicatorProps) {
  // ...
  const color = getStatusColor(currentBAC?.threshold_status ?? "safe");
  // Oblicz procentowy postęp BAC względem progu
  const percent =
    currentBAC &&
    typeof currentBAC.current_threshold === "number" &&
    currentBAC.current_threshold > 0 &&
    typeof currentBAC.current_bac === "number"
      ? Math.min((currentBAC.current_bac / currentBAC.current_threshold) * 100, 100)
      : 0;
  const bacValue =
    currentBAC && typeof currentBAC.current_bac === "number" && !isNaN(currentBAC.current_bac)
      ? currentBAC.current_bac.toFixed(3)
      : "--";
  return (
    <div className="flex items-center gap-2" data-testid="bac-indicator">
      <div className="w-32">
        <div className="h-3 rounded-full bg-gray-200 dark:bg-gray-700 relative overflow-hidden">
          <div
            className={`h-3 rounded-full transition-all duration-300 ${color}`}
            style={{ width: `${percent}%`, opacity: percent > 0 ? 1 : 0.2 }}
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
          />
        </div>
      </div>
      <span className="font-mono text-lg" aria-label="BAC" data-testid="bac-value">
        {bacValue}‰
      </span>
    </div>
  );
}

const BACIndicator = React.memo(BACIndicatorComponent);
BACIndicator.displayName = "BACIndicator";

export default BACIndicator;
