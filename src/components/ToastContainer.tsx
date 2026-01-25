import React, { useEffect } from "react";
import type { ToastViewModel } from "../types";

interface ToastContainerProps {
  toasts: ToastViewModel[];
  onClose: (id: number | string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
  useEffect(() => {
    // Automatyczne zamykanie toastów z autoClose
    const timers: NodeJS.Timeout[] = [];
    toasts.forEach((toast) => {
      if (toast.autoClose) {
        const timer = setTimeout(() => onClose(toast.id), 5000);
        timers.push(timer);
      }
    });
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [toasts, onClose]);

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2" aria-live="polite" role="alert">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded shadow-lg px-4 py-2 bg-neutral-900 text-white flex items-center gap-2 ${toast.type === "error" ? "bg-red-600" : toast.type === "warning" ? "bg-yellow-500" : "bg-neutral-900"}`}
        >
          <span>{toast.message}</span>
          <button
            className="ml-2 text-white/80 hover:text-white focus:outline-none"
            aria-label="Zamknij powiadomienie"
            onClick={() => onClose(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};
