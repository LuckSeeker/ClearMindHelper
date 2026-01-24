import React, { useState } from "react";
import { Button } from "@/components/ui/button";
// Lokalny typ formularza, bo nie jest eksportowany z types.ts
export interface AddDrinkFormModel {
  volume_ml: number | "";
  abv_percent: number | "";
  consumed_at: string;
  errors: Record<string, string>;
  isEditing: boolean;
  drinkId?: number;
}

interface AddEditDrinkModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: AddDrinkFormModel) => void;
  initialValues?: AddDrinkFormModel;
  isEditing?: boolean;
  warning?: string;
}

// Zwraca aktualny czas w lokalnej strefie w formacie zgodnym z input type="datetime-local"
const getNowLocal = () => {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

const AddEditDrinkModal: React.FC<AddEditDrinkModalProps> = ({
  open,
  onClose,
  onSubmit,
  initialValues,
  isEditing,
  warning,
}) => {
  const [form, setForm] = useState<AddDrinkFormModel>(
    initialValues || { volume_ml: "", abv_percent: "", consumed_at: getNowLocal(), errors: {}, isEditing: false }
  );

  React.useEffect(() => {
    if (open) {
      setForm(
        initialValues || { volume_ml: "", abv_percent: "", consumed_at: getNowLocal(), errors: {}, isEditing: false }
      );
    }
  }, [open, initialValues]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded shadow-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-4">{isEditing ? "Edytuj napój" : "Dodaj napój"}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(form);
          }}
          className="flex flex-col gap-3"
        >
          <label>
            Objętość [ml]
            <input
              type="number"
              min={1}
              max={5000}
              value={form.volume_ml}
              onChange={(e) => {
                const value = e.target.value;
                setForm({ ...form, volume_ml: value === "" ? "" : Number(value) });
              }}
              className="input input-bordered w-full"
              required
            />
          </label>
          <label>
            Alk. [%]
            <input
              type="number"
              min={0.1}
              max={100}
              step={0.1}
              value={form.abv_percent}
              onChange={(e) => {
                const value = e.target.value;
                setForm({ ...form, abv_percent: value === "" ? "" : Number(value) });
              }}
              className="input input-bordered w-full"
              required
            />
          </label>
          <label>
            Czas spożycia
            <input
              type="datetime-local"
              value={form.consumed_at}
              onChange={(e) => setForm({ ...form, consumed_at: e.target.value })}
              className="input input-bordered w-full"
              required
            />
          </label>
          {warning && <div className="text-yellow-700 bg-yellow-100 p-2 rounded">{warning}</div>}
          <div className="flex gap-2 mt-4 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Anuluj
            </Button>
            <Button type="submit" variant="default">
              Zapisz
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEditDrinkModal;
