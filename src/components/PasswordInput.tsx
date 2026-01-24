import React from "react";

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({ value, onChange, error, inputRef }) => (
  <div className="flex flex-col gap-1">
    <label htmlFor="password" className="text-sm font-medium">
      Hasło
    </label>
    <input
      id="password"
      type="password"
      autoComplete="current-password"
      className={`input input-bordered w-full ${error ? "border-destructive" : ""}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={!!error}
      aria-describedby={error ? "password-error" : undefined}
      required
      minLength={8}
      ref={inputRef}
    />
    {error && (
      <span id="password-error" className="text-xs text-destructive">
        {error}
      </span>
    )}
  </div>
);
