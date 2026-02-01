import React from "react";
import { Button } from "./ui/button";

interface ThresholdExceededModalProps {
  open: boolean;
  maxBAC: number;
  threshold: number;
  onConfirm: () => void;
  onCancel: () => void;
}

const ThresholdExceededModal: React.FC<ThresholdExceededModalProps> = ({
  open,
  maxBAC,
  threshold,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" data-testid="threshold-exceeded-modal">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-2 text-red-700 dark:text-red-400 flex items-center gap-2">
          <span>Przekroczono próg BAC!</span>
        </h2>
        <div className="mb-4 text-sm text-zinc-700 dark:text-zinc-200">
          Maksymalne BAC podczas tej imprezy (<b>{maxBAC.toFixed(3)}‰</b>) przekroczyło Twój aktualny próg (
          <b>{threshold.toFixed(3)}‰</b>).
        </div>
        <div className="mb-4 text-sm text-zinc-700 dark:text-zinc-200">
          Czy chcesz zaktualizować swój próg do tej wartości, czy oznaczyć blackout?
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="destructive" onClick={onCancel}>
            Oznacz blackout
          </Button>
          <Button onClick={onConfirm}>Zaktualizuj próg</Button>
        </div>
      </div>
    </div>
  );
};

export default ThresholdExceededModal;
