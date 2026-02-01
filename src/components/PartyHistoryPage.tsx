import React, { useState, useCallback } from "react";
import { usePartyHistory } from "./hooks/usePartyHistory";
import { usePartyDetail } from "./hooks/usePartyDetail";
import PartyHistoryTable from "./PartyHistoryTable.tsx";
import PartyDetailModal from "./PartyDetailModal";
import RefreshButton from "./RefreshButton";
import { Button } from "./ui/button";
import Alert from "./Alert.tsx";
import Pagination from "./Pagination.tsx";

const PartyHistoryPage: React.FC = () => {
  const { parties, pagination, loading, error, refreshing, fetchPage, refresh } = usePartyHistory();
  const [selectedPartyId, setSelectedPartyId] = useState<number | null>(null);
  const { partyDetail, loading: detailLoading, error: detailError, fetchDetail, clearDetail } = usePartyDetail();
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "info" | "error" | "success" } | null>(null);

  const handleSelectParty = useCallback(
    (partyId: number) => {
      setSelectedPartyId(partyId);
      setShowDetailModal(true);
      fetchDetail(partyId);
    },
    [fetchDetail]
  );

  const handleCloseModal = useCallback(() => {
    setShowDetailModal(false);
    clearDetail();
  }, [clearDetail]);

  const handlePageChange = useCallback(
    (page: number) => {
      fetchPage(page);
    },
    [fetchPage]
  );

  // Przykład użycia toastów po odświeżeniu lub błędzie
  React.useEffect(() => {
    if (error) setToast({ message: error, type: "error" });
  }, [error]);

  return (
    <section className="w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Historia imprez</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => (window.location.href = "/party")}>
            Wróć do imprezy
          </Button>
          <RefreshButton
            onClick={() => {
              refresh();
              setToast({ message: "Odświeżono dane", type: "success" });
            }}
            loading={refreshing}
          />
        </div>
      </div>
      {toast && <Alert message={toast.message} type={toast.type} autoHideMs={3500} onClose={() => setToast(null)} />}
      <PartyHistoryTable parties={parties} onSelect={handleSelectParty} pagination={pagination} loading={loading} />
      <Pagination page={pagination.page} totalPages={pagination.total_pages} onPageChange={handlePageChange} />
      <PartyDetailModal
        partyId={selectedPartyId}
        open={showDetailModal}
        onClose={handleCloseModal}
        partyDetail={partyDetail}
        loading={detailLoading}
        error={detailError}
      />
    </section>
  );
};

export default PartyHistoryPage;
