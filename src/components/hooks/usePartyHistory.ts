import { useState, useEffect, useCallback } from "react";
import type { PartyListItemDTO, PartyListResponseDTO, PaginationMeta } from "../../types";

interface UsePartyHistoryResult {
  parties: PartyListItemDTO[];
  pagination: PaginationMeta;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  fetchPage: (page: number) => void;
  refresh: () => void;
}

const DEFAULT_PAGINATION: PaginationMeta = {
  page: 1,
  limit: 10,
  total_count: 0,
  total_pages: 1,
};

export function usePartyHistory(): UsePartyHistoryResult {
  const [parties, setParties] = useState<PartyListItemDTO[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>(DEFAULT_PAGINATION);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    (page: number) => {
      setLoading(true);
      setError(null);
      fetch(`/api/parties?page=${page}&limit=${pagination.limit}`)
        .then(async (res) => {
          if (!res.ok) throw new Error("Błąd pobierania historii imprez");
          const data: PartyListResponseDTO = await res.json();
          setParties(Array.isArray(data.data) ? data.data : []);
          setPagination(data.pagination);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    },
    [pagination.limit]
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    setError(null);
    fetch(`/api/parties?page=${pagination.page}&limit=${pagination.limit}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Błąd odświeżania historii imprez");
        const data: PartyListResponseDTO = await res.json();
        setParties(Array.isArray(data.data) ? data.data : []);
        setPagination(data.pagination);
      })
      .catch((err) => setError(err.message))
      .finally(() => setRefreshing(false));
  }, [pagination.page, pagination.limit]);

  useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);

  return {
    parties,
    pagination,
    loading,
    error,
    refreshing,
    fetchPage,
    refresh,
  };
}
