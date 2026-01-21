import type { CurrentThresholdResponseDTO, UpdateThresholdCommand } from "../../types";
import { useApiResource } from "./useApiResource";

export function useThreshold() {
  const resource = useApiResource<CurrentThresholdResponseDTO>("/api/thresholds/current");

  const updateThreshold = async (command: UpdateThresholdCommand) => {
    await resource.refetch();
    await fetch("/api/thresholds/current", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
      },
      body: JSON.stringify(command),
    });
    await resource.refetch();
  };

  return {
    threshold: resource.data,
    isLoading: resource.isLoading,
    error: resource.error,
    errorCode: resource.errorCode,
    refetch: resource.refetch,
    updateThreshold,
  };
}
