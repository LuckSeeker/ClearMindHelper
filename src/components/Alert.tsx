import React, { useEffect, useRef, useState } from "react";

interface AlertProps {
  message: string;
  type: "error" | "info" | "success";
  autoHideMs?: number;
  onClose?: () => void;
}

const Alert: React.FC<AlertProps> = React.memo(({ message, type, autoHideMs = 4000, onClose }) => {
  const [visible, setVisible] = useState(true);
  const timer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (autoHideMs && onClose) {
      timer.current = setTimeout(() => {
        setVisible(false);
        onClose();
      }, autoHideMs);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [autoHideMs, onClose]);

  const handleClose = React.useCallback(() => {
    setVisible(false);
    if (onClose) onClose();
  }, [onClose]);

  if (!visible) return null;
  let bg = "bg-blue-100 text-blue-700";
  if (type === "error") bg = "bg-red-100 text-red-700";
  if (type === "success") bg = "bg-green-100 text-green-700";
  return (
    <div className={`my-2 px-4 py-2 rounded flex items-center justify-between ${bg}`} role="alert">
      <span>{message}</span>
      {onClose && (
        <button className="ml-2 text-lg" onClick={handleClose} aria-label="Zamknij">
          ✕
        </button>
      )}
    </div>
  );
});
Alert.displayName = "Alert";

export default Alert;
