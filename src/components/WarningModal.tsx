import React from "react";
import type { DrinkValidationWarning } from "../types";
import { Button } from "@/components/ui/button";

interface WarningModalProps {
  warning: DrinkValidationWarning | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function WarningModalComponent({ warning, onConfirm, onCancel }: WarningModalProps) {
  if (!warning) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" data-testid="warning-modal">
      <div className="bg-white rounded shadow-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-4">Ostrzeżenie</h2>
        <div className="mb-4 text-yellow-800 bg-yellow-100 p-2 rounded">
          {warning.message || "Wartości napoju wydają się nierealistyczne lub spożycie nastąpiło zbyt szybko."}
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel}>
            Popraw
          </Button>
          <Button variant="default" onClick={onConfirm}>
            Potwierdź
          </Button>
        </div>
      </div>
    </div>
  );
}

const WarningModal = React.memo(WarningModalComponent);
WarningModal.displayName = "WarningModal";

export default WarningModal;
