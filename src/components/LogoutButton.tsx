import React, { useState } from "react";

const LogoutButton: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/";
    } catch {
      alert("Błąd wylogowania. Spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="px-4 py-2 rounded bg-destructive text-white hover:bg-destructive/80 transition"
      aria-label="Wyloguj się"
    >
      {loading ? "Wylogowywanie..." : "Wyloguj się"}
    </button>
  );
};

export default LogoutButton;
