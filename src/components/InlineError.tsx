import React from "react";

interface InlineErrorProps {
  message: string;
  onClose?: () => void;
}

export const InlineError: React.FC<InlineErrorProps> = ({ message, onClose }) => {
  if (!message) return null;
  return (
    <div
      className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mt-2"
      role="alert"
      aria-live="assertive"
      data-testid="alert-item"
    >
      <span aria-hidden="true">❗</span>
      <span>{message}</span>
      {onClose && (
        <button
          className="ml-2 text-red-500 hover:text-red-700 focus:outline-none"
          aria-label="Zamknij błąd"
          onClick={onClose}
        >
          ×
        </button>
      )}
    </div>
  );
};
