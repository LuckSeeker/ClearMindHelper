import { useCallback, useState } from "react";

export function useAuthForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | undefined>(undefined);

  // Walidacja email
  const validateEmail = useCallback((value: string) => {
    if (!value) return "E-mail jest wymagany";
    // RFC 5322 simple regex
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Niepoprawny format e-mail";
    return undefined;
  }, []);

  // Walidacja hasła
  const validatePassword = useCallback((value: string) => {
    if (!value) return "Hasło jest wymagane";
    if (value.length < 8) return "Hasło musi mieć min. 8 znaków";
    return undefined;
  }, []);

  // Obsługa zmiany pól
  const handleEmailChange = (v: string) => {
    setEmail(v);
    setErrors((e) => ({ ...e, email: validateEmail(v) }));
  };
  const handlePasswordChange = (v: string) => {
    setPassword(v);
    setErrors((e) => ({ ...e, password: validatePassword(v) }));
  };

  // Walidacja całościowa
  const validate = useCallback(() => {
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    setErrors({ email: emailError, password: passwordError });
    return !emailError && !passwordError;
  }, [email, password, validateEmail, validatePassword]);

  // Submit blokowany przy błędach lub loadingu
  const canSubmit = !loading && !errors.email && !errors.password && email && password;

  return {
    email,
    password,
    errors,
    loading,
    apiError,
    setApiError,
    setLoading,
    handleEmailChange,
    handlePasswordChange,
    validate,
    canSubmit,
    setEmail,
    setPassword,
  };
}
