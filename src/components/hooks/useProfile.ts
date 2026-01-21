import type { UserProfileDTO, UpdateUserProfileCommand } from "../../types";
import { useApiResource } from "./useApiResource";

export function useProfile() {
  const resource = useApiResource<UserProfileDTO>("/api/profile");

  const updateProfile = async (command: UpdateUserProfileCommand) => {
    await fetch("/api/profile", {
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
    profile: resource.data,
    isLoading: resource.isLoading,
    error: resource.error,
    errorCode: resource.errorCode,
    refetch: resource.refetch,
    updateProfile,
  };
}
