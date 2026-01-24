import React from "react";

type AuthMode = "login" | "register";

interface SwitchAuthLinkProps {
  mode: AuthMode;
}

export const SwitchAuthLink: React.FC<SwitchAuthLinkProps> = ({ mode }) => {
  return mode === "login" ? (
    <div className="text-sm text-center">
      Nie masz konta?{" "}
      <a href="/register" className="text-primary underline underline-offset-4 hover:underline">
        Zarejestruj się
      </a>
    </div>
  ) : (
    <div className="text-sm text-center">
      Masz już konto?{" "}
      <a href="/login" className="text-primary underline underline-offset-4 hover:underline">
        Zaloguj się
      </a>
    </div>
  );
};
