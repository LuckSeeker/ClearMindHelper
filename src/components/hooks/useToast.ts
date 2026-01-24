import { useCallback, useState } from "react";

export function useToast() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"info" | "success" | "error">("info");

  const showToast = useCallback((msg: string, toastType: "info" | "success" | "error" = "info") => {
    setMessage(msg);
    setType(toastType);
    setOpen(true);
  }, []);

  const closeToast = useCallback(() => setOpen(false), []);

  return { open, message, type, showToast, closeToast };
}
