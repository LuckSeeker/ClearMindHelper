import React from "react";
import BACIndicator from "./BACIndicator";
import { AlertsPanel } from "./AlertsPanel.tsx";
import type { PartyDetailDTO, CurrentBACResponseDTO } from "../types";

interface PartyHeaderProps {
  party: PartyDetailDTO;
  currentBAC: CurrentBACResponseDTO | null;
}

function PartyHeaderComponent({ currentBAC }: PartyHeaderProps) {
  return (
    <header className="flex flex-col gap-2 w-full" data-testid="party-header">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">Aktywna impreza</h2>
          {/* Status removed as requested */}
        </div>
        {currentBAC && <BACIndicator currentBAC={currentBAC} />}
      </div>
      <AlertsPanel />
    </header>
  );
}

const PartyHeader = React.memo(PartyHeaderComponent);
PartyHeader.displayName = "PartyHeader";

export default PartyHeader;
