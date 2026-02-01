import React from "react";

interface EmailInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export const EmailInput: React.FC<EmailInputProps> = ({ value, onChange, error, inputRef }) => (
  <div className="flex flex-col gap-1">
    <label htmlFor="email" className="text-sm font-medium">
      E-mail
    </label>
    <input
      id="email"
      type="email"
      autoComplete="email"
      className={`input input-bordered w-full ${error ? "border-destructive" : ""}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={!!error}
      aria-describedby={error ? "email-error" : undefined}
      required
      ref={inputRef}
      data-testid="email-input"
    />
    {error && (
      <span id="email-error" className="text-xs text-destructive">
        {error}
      </span>
    )}
  </div>
);
