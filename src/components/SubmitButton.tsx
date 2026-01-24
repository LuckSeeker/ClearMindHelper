import React from "react";
import { Button } from "@/components/ui/button";

interface SubmitButtonProps {
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}

export const SubmitButton: React.FC<SubmitButtonProps> = ({ disabled, loading, children }) => (
  <Button type="submit" disabled={disabled || loading} className="w-full">
    {loading ? <span className="animate-spin mr-2">⏳</span> : null}
    {children}
  </Button>
);
