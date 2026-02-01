import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";

interface ToastProps {
  open: boolean;
  message: string;
  type?: "info" | "success" | "error";
  onClose: () => void;
}

const getToastColor = (type: string) => {
  switch (type) {
    case "success":
      return "bg-green-600 text-white";
    case "error":
      return "bg-red-600 text-white";
    case "info":
    default:
      return "bg-neutral-800 text-white";
  }
};

function ToastComponent({ open, message, type = "info", onClose }: ToastProps) {
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [open, onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 px-4 py-2 rounded shadow-lg flex items-center gap-2 ${getToastColor(type)}`}
      role="alert"
      aria-live="assertive"
      style={{ display: open ? "flex" : "none" }}
    >
      <span>{message}</span>
      <Button variant="ghost" size="sm" onClick={onClose} aria-label="Zamknij powiadomienie">
        ×
      </Button>
    </div>
  );
}

const Toast = React.memo(ToastComponent);
Toast.displayName = "Toast";

export default Toast;
