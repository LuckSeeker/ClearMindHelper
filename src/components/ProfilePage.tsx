import React from "react";
import { useProfile } from "./hooks/useProfile";
import { useThreshold } from "./hooks/useThreshold";
import { useThresholdHistory } from "./hooks/useThresholdHistory";
import ProfileForm from "./ProfileForm.tsx";
import ThresholdCard from "./ThresholdCard";
import ThresholdHistoryTable from "./ThresholdHistoryTable.tsx";
import ThresholdChangeModal from "./ThresholdChangeModal";

import LogoutButton from "./LogoutButton";

import { Button } from "./ui/button";

const ProfilePage: React.FC = () => {
  // Custom hooks for API integration
  const {
    profile,
    isLoading: profileLoading,
    error: profileError,
    errorCode: profileErrorCode,
    refetch: refetchProfile,
    updateProfile,
  } = useProfile();
  const { threshold, errorCode: thresholdErrorCode, refetch: refetchThreshold, updateThreshold } = useThreshold();
  const {
    history,
    isLoading: historyLoading,
    error: historyError,
    errorCode: historyErrorCode,
    refetch: refetchHistory,
  } = useThresholdHistory();

  // Odśwież próg i historię przy każdym wejściu na /profile
  React.useEffect(() => {
    refetchThreshold();
    refetchHistory();
  }, [refetchThreshold, refetchHistory]);

  // Modal state for threshold change
  const [isModalOpen, setModalOpen] = React.useState(false);
  const [modalError, setModalError] = React.useState<string | null>(null);
  const [isSubmittingThreshold, setSubmittingThreshold] = React.useState(false);

  // Handlers
  const handleProfileSubmit = async (data: Parameters<typeof updateProfile>[0]) => {
    await updateProfile(data);
    refetchProfile();
    refetchThreshold();
  };

  const handleThresholdChangeClick = () => {
    setModalOpen(true);
    setModalError(null);
  };

  const handleThresholdSubmit = async (value: number) => {
    setSubmittingThreshold(true);
    setModalError(null);
    try {
      await updateThreshold({ threshold_bac: value });
      await refetchThreshold();
      // Odśwież historię tylko po udanej zmianie progu
      await refetchHistory();
      setModalOpen(false);
    } catch (err) {
      if (err instanceof Error) setModalError(err.message);
      else setModalError("Błąd zmiany progu");
    } finally {
      setSubmittingThreshold(false);
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setModalError(null);
  };

  // Block actions if profile is incomplete or global error
  const isProfileComplete = profile?.is_complete;

  // Global error handling
  let globalErrorMsg: string | null = null;
  let isCriticalError = false;
  const errorCodes = [profileErrorCode, thresholdErrorCode, historyErrorCode];
  if (errorCodes.includes("UNAUTHORIZED") || errorCodes.includes("401")) {
    globalErrorMsg = "Sesja wygasła lub brak autoryzacji. Zaloguj się ponownie.";
    isCriticalError = true;
  } else if (errorCodes.includes("PARTY_NOT_FOUND") || errorCodes.includes("NOT_FOUND") || errorCodes.includes("404")) {
    globalErrorMsg = "Nie znaleziono zasobu lub nie masz dostępu.";
    isCriticalError = true;
  } else if (
    errorCodes.includes("INTERNAL_SERVER_ERROR") ||
    errorCodes.includes("DATABASE_ERROR") ||
    errorCodes.includes("500")
  ) {
    globalErrorMsg = "Wystąpił błąd serwera. Spróbuj ponownie później.";
    isCriticalError = true;
  }

  return (
    <main className="max-w-2xl mx-auto py-8 px-4" role="main">
      {/* Navigation to Party */}
      <div className="flex justify-end mb-4">
        <Button variant="secondary" onClick={() => (window.location.href = "/party")}>
          Przejdź do imprezy
        </Button>
      </div>
      {/* Logout Button (visible only on /profile) */}
      <div className="flex justify-end mb-6">
        <LogoutButton />
      </div>
      {/* Global error message */}
      {globalErrorMsg && (
        <div
          className="text-red-600 bg-red-50 border border-red-200 rounded p-4 mb-4 text-center font-semibold"
          role="alert"
          aria-live="assertive"
        >
          {globalErrorMsg}
        </div>
      )}
      {/* Profile Form */}
      <section className="mb-8" aria-labelledby="profile-form-heading">
        <h2 id="profile-form-heading" className="text-xl font-semibold mb-2">
          Twój profil
        </h2>
        <ProfileForm
          profile={profile}
          onSubmit={handleProfileSubmit}
          isSubmitting={profileLoading || isCriticalError}
          errors={profileError ? { global: profileError } : {}}
        />
      </section>
      {/* Threshold Card */}
      <section className="mb-8" aria-labelledby="threshold-card-heading">
        <h2 id="threshold-card-heading" className="text-xl font-semibold mb-2">
          Próg ostrzeżenia
        </h2>
        <ThresholdCard
          threshold={threshold}
          onChangeClick={handleThresholdChangeClick}
          isBlocked={!isProfileComplete || isCriticalError}
        />
      </section>
      {/* Threshold Change Modal */}
      <ThresholdChangeModal
        isOpen={isModalOpen && !isCriticalError}
        onClose={handleModalClose}
        onSubmit={handleThresholdSubmit}
        isSubmitting={isSubmittingThreshold}
        error={modalError}
        currentValue={threshold?.threshold_bac}
      />
      {/* Threshold History Table */}
      <section aria-labelledby="threshold-history-heading">
        <h2 id="threshold-history-heading" className="text-xl font-semibold mb-2">
          Historia zmian progu
        </h2>
        <ThresholdHistoryTable items={history} isLoading={historyLoading} error={historyError} />
      </section>
    </main>
  );
};

export default ProfilePage;
