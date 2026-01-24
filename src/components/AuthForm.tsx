import React from "react";
import { EmailInput } from "./EmailInput";
import { PasswordInput } from "./PasswordInput";
import { ErrorMessage } from "./ErrorMessage";
import { SubmitButton } from "./SubmitButton";
import { SwitchAuthLink } from "./SwitchAuthLink";
import { useAuthForm } from "./hooks/useAuthForm";

export type AuthMode = "login" | "register";

interface AuthFormProps {
  mode: AuthMode;
}

const AuthForm: React.FC<AuthFormProps> = ({ mode }) => {
  const {
    email,
    password,
    errors,
    loading,
    apiError,
    setApiError,
    handleEmailChange,
    handlePasswordChange,
    validate,
    canSubmit,
  } = useAuthForm();

  const emailRef = React.useRef<HTMLInputElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);
  const errorMsgRef = React.useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(undefined);
    if (!validate()) {
      // focus na pierwszym błędnym polu
      if (errors.email && emailRef.current) {
        emailRef.current.focus();
      } else if (errors.password && passwordRef.current) {
        passwordRef.current.focus();
      }
      return;
    }
    try {
      const endpoint = mode === "login" ? "/api/login" : "/api/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        let errorMsg = "Wystąpił błąd. Spróbuj ponownie.";
        if (res.status === 401) errorMsg = "Nieprawidłowy e-mail lub hasło.";
        if (res.status === 409) errorMsg = "Użytkownik o tym e-mailu już istnieje.";
        try {
          const data = await res.json();
          if (data && data.message) errorMsg = data.message;
        } catch {
          // ignorujemy błąd parsowania JSON odpowiedzi
        }
        setApiError(errorMsg);
        // focus na ErrorMessage po błędzie globalnym
        setTimeout(() => {
          if (errorMsgRef.current) errorMsgRef.current.focus();
        }, 0);
        return;
      }
      // Sukces: przekierowanie do strony głównej
      window.location.href = "/";
    } catch {
      setApiError("Błąd sieci. Spróbuj ponownie.");
      setTimeout(() => {
        if (errorMsgRef.current) errorMsgRef.current.focus();
      }, 0);
    }
  };

  return (
    <form className="w-full flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <EmailInput value={email} onChange={handleEmailChange} error={errors.email} inputRef={emailRef} />
      <PasswordInput value={password} onChange={handlePasswordChange} error={errors.password} inputRef={passwordRef} />
      <ErrorMessage message={apiError} ariaLive ref={errorMsgRef} />
      <SubmitButton disabled={!canSubmit} loading={loading}>
        {mode === "login" ? "Zaloguj się" : "Zarejestruj się"}
      </SubmitButton>
      <SwitchAuthLink mode={mode} />
    </form>
  );
};

export default AuthForm;
