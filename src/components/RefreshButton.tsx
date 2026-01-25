import React from "react";

interface RefreshButtonProps {
  onClick: () => void;
  loading: boolean;
}

const RefreshButton: React.FC<RefreshButtonProps> = React.memo(({ onClick, loading }) => {
  const handleClick = React.useCallback(() => {
    onClick();
  }, [onClick]);
  return (
    <button
      className="inline-flex items-center px-3 py-1.5 rounded bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 transition disabled:opacity-50"
      onClick={handleClick}
      disabled={loading}
      aria-label="Odśwież listę"
    >
      {loading ? "Odświeżanie..." : "Odśwież"}
    </button>
  );
});
RefreshButton.displayName = "RefreshButton";

export default RefreshButton;
