import React, { useEffect, useRef } from "react";
import type { ModalAlertViewModel } from "../types";

interface AlertModalProps {
  alert: ModalAlertViewModel | null;
  onClose: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({ alert, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!alert) return;
    // Focus trap: focus na modal po otwarciu
    closeBtnRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // Trap focus
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [alert, onClose]);
  if (!alert) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-desc"
      ref={modalRef}
    >
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full outline-none">
        <h2 id="modal-title" className="text-lg font-bold mb-2">
          {alert.title}
        </h2>
        <div id="modal-desc" className="mb-4">
          {alert.message}
        </div>
        <div className="flex gap-2 justify-end">
          {alert.actions?.map((action, idx) => (
            <button
              key={idx}
              className="px-4 py-2 rounded bg-neutral-800 text-white hover:bg-neutral-700"
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
          <button
            ref={closeBtnRef}
            className="px-4 py-2 rounded bg-neutral-400 text-black hover:bg-neutral-300"
            onClick={onClose}
            aria-label="Zamknij modal"
            data-testid="alert-modal-close"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
