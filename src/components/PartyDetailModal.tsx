import React from "react";
import type { PartyDetailDTO } from "../types";

interface PartyDetailModalProps {
  partyId: number | null;
  open: boolean;
  onClose: () => void;
  partyDetail: PartyDetailDTO | null;
  loading: boolean;
  error: string | null;
}

const PartyDetailModal: React.FC<PartyDetailModalProps> = React.memo(function PartyDetailModal({
  open,
  onClose,
  partyDetail,
  loading,
  error,
}) {
  const modalRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (open && modalRef.current) {
      modalRef.current.focus();
    }
  }, [open]);
  const handleClose = React.useCallback(() => {
    onClose();
  }, [onClose]);
  const drinksTable = React.useMemo(() => {
    if (!partyDetail || !Array.isArray(partyDetail.drinks) || partyDetail.drinks.length === 0) {
      return <div className="text-neutral-400">Brak napojów</div>;
    }
    return (
      <table className="w-full text-xs mt-2 border">
        <thead>
          <tr className="bg-neutral-100 dark:bg-neutral-800">
            <th className="px-2 py-1 text-center">Czas</th>
            <th className="px-2 py-1 text-center">Objętość</th>
            <th className="px-2 py-1 text-center">%</th>
            <th className="px-2 py-1 text-center">BAC</th>
          </tr>
        </thead>
        <tbody>
          {partyDetail.drinks.map((drink) => (
            <tr key={drink.id}>
              <td className="px-2 py-1 whitespace-nowrap text-center">
                {drink.consumed_at ? new Date(drink.consumed_at).toLocaleTimeString() : "-"}
              </td>
              <td className="px-2 py-1 text-center">{drink.volume_ml} ml</td>
              <td className="px-2 py-1 text-center">{drink.abv_percent}%</td>
              <td className="px-2 py-1 text-center">
                {drink.bac_calculation && typeof drink.bac_calculation.calculated_bac === "number"
                  ? drink.bac_calculation.calculated_bac.toFixed(2) + " ‰"
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }, [partyDetail]);

  const alertsList = React.useMemo(() => {
    if (!partyDetail || !Array.isArray(partyDetail.all_alerts) || partyDetail.all_alerts.length === 0) {
      return <div className="text-neutral-400">Brak alertów</div>;
    }
    return (
      <ul className="list-disc ml-5 mt-1">
        {partyDetail.all_alerts.map((alert) => (
          <li
            key={alert.id}
            className={`text-xs ${alert.is_active ? "text-red-700 dark:text-red-400" : "text-neutral-500 dark:text-neutral-400"}`}
          >
            {alert.alert_type} (BAC: {alert.bac_at_alert?.toFixed(2) ?? "-"} ‰)
            {!alert.is_active && <span className="ml-1">(nieaktywny)</span>}
          </li>
        ))}
      </ul>
    );
  }, [partyDetail]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" role="dialog" aria-modal="true">
      <div
        className="relative bg-white dark:bg-neutral-900 rounded shadow-lg p-6 min-w-[340px] max-w-lg w-full max-h-[90vh] overflow-y-auto"
        ref={modalRef}
      >
        <button
          className="absolute top-2 right-2 text-xl cursor-pointer select-none"
          aria-label="Zamknij"
          type="button"
          onClick={handleClose}
        >
          ✕
        </button>
        <h2 className="text-lg font-bold mb-2">Szczegóły imprezy</h2>
        {loading && <div className="text-neutral-500">Ładowanie...</div>}
        {error && <div className="text-red-600">{error}</div>}
        {!loading && !error && partyDetail && (
          <div className="space-y-4">
            <div>
              <span className="font-semibold">Data rozpoczęcia:</span>{" "}
              {partyDetail.started_at ? new Date(partyDetail.started_at).toLocaleString() : "-"}
            </div>
            <div>
              <span className="font-semibold">Snapshot profilu:</span>
              {partyDetail.profile_snapshot ? (
                <pre className="bg-neutral-100 dark:bg-neutral-800 rounded p-2 text-xs mt-1 overflow-x-auto">
                  {JSON.stringify(partyDetail.profile_snapshot, null, 2)}
                </pre>
              ) : (
                <div className="text-neutral-400">Brak snapshotu profilu</div>
              )}
            </div>
            <div>
              <span className="font-semibold">Napoje:</span>
              {drinksTable}
            </div>
            <div>
              <span className="font-semibold">Alerty:</span>
              {alertsList}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
PartyDetailModal.displayName = "PartyDetailModal";

export default PartyDetailModal;
