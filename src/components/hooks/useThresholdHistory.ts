import type { ThresholdHistoryResponseDTO } from "../../types";
import { useApiResource } from "./useApiResource";

export function useThresholdHistory() {
  const resource = useApiResource<ThresholdHistoryResponseDTO>("/api/thresholds/history");

  return {
    history: Array.isArray(resource.data?.data) ? resource.data.data : [],
    isLoading: resource.isLoading,
    error: resource.error,
    errorCode: resource.errorCode,
    refetch: resource.refetch,
  };
}
