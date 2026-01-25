import React from "react";
import BACIndicator from "./BACIndicator";
import { AlertsPanel } from "./AlertsPanel.tsx";
import type { PartyDetailDTO, CurrentBACResponseDTO } from "../types";

interface PartyHeaderProps {
  party: PartyDetailDTO;
  currentBAC: CurrentBACResponseDTO | null;
}

function PartyHeaderComponent({ party, currentBAC }: PartyHeaderProps) {
  return (
    <header className="flex flex-col gap-2 w-full">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">Aktywna impreza</h2>
          <div className="text-sm text-muted-foreground">
            Status: <span className="font-medium">{party.status}</span>
          </div>
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
