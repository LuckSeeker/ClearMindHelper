import React from "react";
import type { DrinkWithBACDTO, PartyDetailDTO } from "../types";
import { Button } from "@/components/ui/button";

interface DrinksTableProps {
  drinks: DrinkWithBACDTO[];
  party: PartyDetailDTO;
  onAdd: () => void;
  onEdit: (drinkId: number) => void;
}

function DrinksTableComponent({ drinks, party, onAdd, onEdit }: DrinksTableProps) {
  const safeDrinks = Array.isArray(drinks) ? drinks : [];
  const canEdit = party.status === "ongoing" && safeDrinks.length > 0;

  return (
    <div className="w-full mt-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold text-lg">Napoje</h3>
        <Button variant="outline" size="sm" onClick={onAdd} aria-label="Dodaj napój" data-testid="add-drink-btn">
          Dodaj napój
        </Button>
      </div>
      <table className="w-full text-sm border rounded overflow-hidden" data-testid="drinks-table">
        <thead className="bg-muted">
          <tr>
            <th className="p-2 text-center">Nazwa</th>
            <th className="p-2 text-center">Objętość [ml]</th>
            <th className="p-2 text-center">Alk. [%]</th>
            <th className="p-2 text-center">Czas spożycia</th>
            <th className="p-2 text-center">BAC po napoju</th>
            <th className="p-2 text-center">Akcja</th>
          </tr>
        </thead>
        <tbody>
          {safeDrinks.map((drink, idx) => (
            <tr key={drink.id} className="border-b">
              <td className="p-2 text-center">{`Napój ${idx + 1}`}</td>
              <td className="p-2 text-center">{drink.volume_ml}</td>
              <td className="p-2 text-center">{drink.abv_percent}</td>
              <td className="p-2 text-center">
                {new Date(drink.consumed_at).toLocaleString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                })}
              </td>
              <td className="p-2 text-center">
                {drink.bac_calculation && typeof drink.bac_calculation.calculated_bac === "number"
                  ? drink.bac_calculation.calculated_bac.toFixed(3) + "‰"
                  : "--"}
              </td>
              <td className="p-2 text-center">
                {canEdit && idx === drinks.length - 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(drink.id)}
                    aria-label="Edytuj napój"
                    data-testid="edit-drink-btn"
                  >
                    Edytuj
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const DrinksTable = React.memo(DrinksTableComponent);
DrinksTable.displayName = "DrinksTable";

export default DrinksTable;
