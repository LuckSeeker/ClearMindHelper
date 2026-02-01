import React from "react";
import { Button } from "@/components/ui/button";
import type { PartyDetailDTO } from "../types";

import type { ClosePartyCommand } from "../types";

interface ClosePartyButtonProps {
  party: PartyDetailDTO;
  onClose: (cmd: ClosePartyCommand) => void | Promise<void>;
}

const ClosePartyButton: React.FC<ClosePartyButtonProps> = ({ party, onClose }) => {
  if (party.status !== "ongoing") return null;
  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={() => onClose({})}
      aria-label="Zamknij imprezę"
      data-testid="close-party-btn"
    >
      Zamknij imprezę
    </Button>
  );
};

export default ClosePartyButton;
