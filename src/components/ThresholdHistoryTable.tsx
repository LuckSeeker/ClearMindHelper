import React from "react";
import type { UserThresholdDTO } from "../types";

interface ThresholdHistoryTableProps {
  items: UserThresholdDTO[];
  isLoading: boolean;
  error: string | null;
}

const ThresholdHistoryTable: React.FC<ThresholdHistoryTableProps> = ({ items, isLoading, error }) => {
  if (isLoading) return <div className="animate-pulse">Ładowanie historii...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!Array.isArray(items) || items.length === 0) return <div>Brak historii progów.</div>;

  return (
    <div className="overflow-x-auto" role="region" aria-labelledby="threshold-history-table-heading">
      <h3 id="threshold-history-table-heading" className="sr-only">
        Tabela historii zmian progów
      </h3>
      <table className="table w-full" aria-describedby="threshold-history-table-heading">
        <thead>
          <tr>
            <th scope="col">Data</th>
            <th scope="col">Próg BAC</th>
            <th scope="col">Powód</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.created_at ? new Date(item.created_at).toLocaleString() : "—"}</td>
              <td>{typeof item.threshold_bac === "number" ? item.threshold_bac.toFixed(2) : "—"}</td>
              <td>{item.reason || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ThresholdHistoryTable;
