import React, { useState, useCallback } from "react";
import { EmailInput } from "./EmailInput";
import { PasswordInput } from "./PasswordInput";
import { SubmitButton } from "./SubmitButton";
import { SwitchAuthLink } from "./SwitchAuthLink";
import { ErrorMessage } from "./ErrorMessage";
import { useGlobalAlertsContext } from "./GlobalAlertsProvider";

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
  const globalAlerts = useGlobalAlertsContext();

  const isLogin = mode === "login";
  const isRegister = mode === "register";
  const isReset = mode === "reset";

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);
      if (mode === "login" || mode === "register") {
        const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
        const successMsg = mode === "login" ? "Zalogowano pomyślnie!" : "Rejestracja zakończona sukcesem!";
        const errorMsg = mode === "login" ? "Błąd logowania. Sprawdź dane." : "Błąd rejestracji. Sprawdź dane.";
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          let data;
          try {
            data = await res.json();
          } catch {
            data = {};
          }
          if (!res.ok) {
            let userMessage = data?.error || errorMsg;
            if (userMessage.includes("fetch failed")) {
              userMessage =
                "Brak połączenia z serwerem. Spróbuj ponownie później lub skontaktuj się z administratorem.";
            }
            setError(userMessage);
            globalAlerts?.dispatch({
              type: "ADD_TOAST",
              toast: {
                id: Date.now() + Math.random(),
                type: "error",
                message: userMessage,
                autoClose: true,
              },
            });
          } else {
            globalAlerts?.dispatch({
              type: "ADD_TOAST",
              toast: {
                id: Date.now() + Math.random(),
                type: "info",
                message: successMsg,
                autoClose: true,
              },
            });
            // Przekierowanie do /profile
            window.location.href = "/profile";
          }
        } catch (err) {
          let userMessage = "Błąd sieci. Spróbuj ponownie.";
          if (err && typeof (err as Error).message === "string" && (err as Error).message.includes("fetch failed")) {
            userMessage = "Brak połączenia z serwerem. Spróbuj ponownie później lub skontaktuj się z administratorem.";
          }
          setError(userMessage);
          globalAlerts?.dispatch({
            type: "ADD_TOAST",
            toast: {
              id: Date.now() + Math.random(),
              type: "error",
              message: userMessage,
              autoClose: true,
            },
          });
        } finally {
          setLoading(false);
        }
        return;
      }
      if (mode === "reset") {
        try {
          const res = await fetch("/api/auth/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
          let data;
          try {
            data = await res.json();
          } catch {
            data = {};
          }
          if (!res.ok) {
            let userMessage = data?.error || "Błąd resetowania hasła. Sprawdź e-mail.";
            if (userMessage.includes("fetch failed")) {
              userMessage =
                "Brak połączenia z serwerem. Spróbuj ponownie później lub skontaktuj się z administratorem.";
            }
            setError(userMessage);
            globalAlerts?.dispatch({
              type: "ADD_TOAST",
              toast: {
                id: Date.now() + Math.random(),
                type: "error",
                message: userMessage,
                autoClose: true,
              },
            });
          } else {
            globalAlerts?.dispatch({
              type: "ADD_TOAST",
              toast: {
                id: Date.now() + Math.random(),
                type: "info",
                message: "Wysłano link resetujący na podany e-mail.",
                autoClose: true,
              },
            });
            setError(null);
          }
        } catch (err) {
          let userMessage = "Błąd sieci. Spróbuj ponownie.";
          if (err && typeof (err as Error).message === "string" && (err as Error).message.includes("fetch failed")) {
            userMessage = "Brak połączenia z serwerem. Spróbuj ponownie później lub skontaktuj się z administratorem.";
          }
          setError(userMessage);
          globalAlerts?.dispatch({
            type: "ADD_TOAST",
            toast: {
              id: Date.now() + Math.random(),
              type: "error",
              message: userMessage,
              autoClose: true,
            },
          });
        } finally {
          setLoading(false);
        }
        return;
      }
      setLoading(false);
    },
    [email, password, mode, globalAlerts]
  );

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
