import React, { useState } from "react";
import { EmailInput } from "./EmailInput";
import { PasswordInput } from "./PasswordInput";
import { SubmitButton } from "./SubmitButton";
import { SwitchAuthLink } from "./SwitchAuthLink";
import { ErrorMessage } from "./ErrorMessage";

export type AuthMode = "login" | "register" | "reset";

interface AuthFormProps {
  mode: AuthMode;
}

const AuthForm: React.FC<AuthFormProps> = ({ mode }) => {
  // UI-only state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isLogin = mode === "login";
  const isRegister = mode === "register";
  const isReset = mode === "reset";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // No-op: backend logic will be added later
    setTimeout(() => {
      setLoading(false);
      setError(null);
    }, 800);
  };

  return (
    <form className="space-y-6 w-full max-w-sm mx-auto" onSubmit={handleSubmit}>
      <h2 className="text-2xl font-bold text-center mb-2">
        {isLogin && "Logowanie"}
        {isRegister && "Rejestracja"}
        {isReset && "Odzyskiwanie hasła"}
      </h2>
      {error && <ErrorMessage message={error} />}
      <EmailInput value={email} onChange={setEmail} />
      {!isReset && <PasswordInput value={password} onChange={setPassword} />}
      <SubmitButton loading={loading}>
        {isLogin && "Zaloguj się"}
        {isRegister && "Zarejestruj się"}
        {isReset && "Wyślij link resetujący"}
      </SubmitButton>
      <div className="flex justify-between text-sm mt-2">
        {isLogin && <SwitchAuthLink to="/register">Nie masz konta?</SwitchAuthLink>}
        {isLogin && <SwitchAuthLink to="/reset-password">Zapomniałeś hasła?</SwitchAuthLink>}
        {isRegister && <SwitchAuthLink to="/login">Masz już konto?</SwitchAuthLink>}
        {isReset && <SwitchAuthLink to="/login">Powrót do logowania</SwitchAuthLink>}
      </div>
    </form>
  );
};

export default AuthForm;
