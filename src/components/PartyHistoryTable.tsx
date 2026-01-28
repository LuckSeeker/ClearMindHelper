import React from "react";
import type { PartyListItemDTO, PaginationMeta } from "../types";
import DrinkPreviewList from "./DrinkPreviewList";

interface PartyHistoryTableProps {
  parties: PartyListItemDTO[];
  onSelect: (partyId: number) => void;
  pagination: PaginationMeta;
  loading: boolean;
}

/**
 * @param props
 * @param props.parties {PartyListItemDTO[]} Lista imprez do wyświetlenia
 * @param props.onSelect {(partyId: number) => void} Callback po kliknięciu imprezy
 * @param props.pagination {PaginationMeta} Dane paginacji (nieużywane w tym komponencie)
 * @param props.loading {boolean} Czy trwa ładowanie
 */
const PartyHistoryTable: React.FC<PartyHistoryTableProps> = React.memo(({ parties, onSelect, loading }) => {
  const handleSelect = React.useCallback((id: number) => onSelect(id), [onSelect]);
  if (loading) {
    return <div className="p-4 text-neutral-500">Ładowanie...</div>;
  }
  if (!parties || parties.length === 0) {
    return <div className="p-4 text-neutral-400">Brak zarejestrowanych imprez</div>;
  }
  return (
    <div className="overflow-x-auto rounded shadow border bg-white dark:bg-neutral-900">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-neutral-100 dark:bg-neutral-800">
            <th className="px-3 py-2 text-left">Data</th>
            <th className="px-3 py-2 text-left">Suma alkoholu</th>
            <th className="px-3 py-2 text-left">Max BAC</th>
            <th className="px-3 py-2 text-left">Blackout</th>
            <th className="px-3 py-2 text-left">Napoje</th>
          </tr>
        </thead>
        <tbody>
          {parties.map((party) => (
            <tr
              key={party.id}
              className="hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer"
              onClick={() => handleSelect(party.id)}
              tabIndex={0}
              aria-label={`Szczegóły imprezy z dnia ${party.started_at}`}
            >
              <td className="px-3 py-2 whitespace-nowrap">
                {party.started_at ? new Date(party.started_at).toLocaleDateString() : "-"}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{party.total_ml_consumed} ml</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {party.bac_estimate_max != null ? `${party.bac_estimate_max.toFixed(2)} ‰` : "-"}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{party.blackout_marked ? "Tak" : "Nie"}</td>
              <td className="px-3 py-2">
                <DrinkPreviewList drinks={party.drinks_preview || []} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

PartyHistoryTable.displayName = "PartyHistoryTable";

export default PartyHistoryTable;
