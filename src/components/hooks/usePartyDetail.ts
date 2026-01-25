import { useState, useCallback } from "react";
import type { PartyDetailDTO } from "../../types";

export function usePartyDetail() {
  const [partyDetail, setPartyDetail] = useState<PartyDetailDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback((id: number) => {
    setLoading(true);
    setError(null);
    fetch(`/api/parties/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Błąd pobierania szczegółów imprezy");
        const data: PartyDetailDTO = await res.json();
        setPartyDetail(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const clearDetail = useCallback(() => {
    setPartyDetail(null);
    setError(null);
  }, []);

  return {
    partyDetail,
    loading,
    error,
    fetchDetail,
    clearDetail,
  };
}
