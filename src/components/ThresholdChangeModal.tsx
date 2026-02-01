import React, { useState } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle, DialogFooter, DialogDescription } from "./ui/dialog";

interface ThresholdChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: number) => void;
  isSubmitting: boolean;
  error: string | null;
  currentValue?: number;
}

const MIN = 0.01;

const ThresholdChangeModal: React.FC<ThresholdChangeModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
  currentValue,
}) => {
  const [value, setValue] = useState<string>(typeof currentValue === "number" ? currentValue.toString() : "");
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  React.useEffect(() => {
    setValue(typeof currentValue === "number" ? currentValue.toString() : "");
    setLocalError(null);
    setConfirmed(false);
  }, [isOpen, currentValue]);

  const validate = () => {
    const v = parseFloat(value);
    if (isNaN(v) || v < MIN) return `Próg musi być większy lub równy ${MIN} ‰`;
    if (!confirmed) return "Musisz potwierdzić zmianę progu";
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    setLocalError(err);
    if (!err) onSubmit(parseFloat(value));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogTitle id="threshold-modal-title">Zmień próg BAC</DialogTitle>
        <DialogDescription>
          Ustaw nowy próg BAC, aby otrzymywać powiadomienia przy jego przekroczeniu.
        </DialogDescription>
        <form onSubmit={handleSubmit} className="space-y-4" aria-labelledby="threshold-modal-title">
          <div>
            <label htmlFor="threshold_bac" className="block font-medium">
              Nowy próg BAC (‰)
            </label>
            <input
              type="number"
              step="0.01"
              min={MIN}
              id="threshold_bac"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="input input-bordered w-full"
              required
              aria-describedby="threshold_bac_error"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="confirm"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              required
            />
            <label htmlFor="confirm" className="text-sm">
              Potwierdzam zmianę progu
            </label>
          </div>
          {(localError || error) && (
            <div id="threshold_bac_error" className="text-red-500 text-sm" role="alert" aria-live="assertive">
              {localError || error}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Anuluj
            </Button>
            <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? "Zapisywanie..." : "Zmień próg"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ThresholdChangeModal;
