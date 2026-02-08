import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:8381/api").replace(/\/$/, "");

function SetupAdminScreen({ onSetupDone }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const canSubmit = useMemo(() => email.trim().length > 3 && password.length > 0, [email, password]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");

    try {
      const response = await fetch(`${apiBase}/setup/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || "Nie udało się utworzyć konta admina");
      }

      setInfo("Admin utworzony. Możesz się zalogować.");
      setPassword("");
      setTimeout(onSetupDone, 400);
    } catch (err) {
      setError(err.message || "Błąd podczas inicjalizacji");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h2>Utwórz admina</h2>
      <p>Pierwsze uruchomienie systemu. Skonfiguruj konto administratora.</p>
      <form onSubmit={onSubmit}>
        <label htmlFor="setup-email">Email</label>
        <input
          id="setup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@example.com"
          required
        />

        <label htmlFor="setup-password">Hasło</label>
        <input
          id="setup-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min. 12 znaków + złożoność"
          required
        />

        <button type="submit" disabled={!canSubmit || loading}>
          {loading ? "Tworzenie..." : "Utwórz admina"}
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {info ? <p className="info">{info}</p> : null}
    </section>
  );
}

function LoginPlaceholder() {
  return (
    <section>
      <h2>Logowanie</h2>
      <p>Setup zakończony. W kolejnym kroku podłączony zostanie pełny flow logowania.</p>
      <form>
        <label htmlFor="login-email">Email</label>
        <input id="login-email" type="email" placeholder="admin@example.com" disabled />
        <label htmlFor="login-password">Hasło</label>
        <input id="login-password" type="password" placeholder="********" disabled />
        <button type="button" disabled>
          Zaloguj
        </button>
      </form>
    </section>
  );
}

function App() {
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState("");

  const loadStatus = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${apiBase}/setup/status`);
      const data = await response.json();
      setNeedsSetup(Boolean(data.needs_setup));
    } catch (err) {
      setError(err.message || "Nie można pobrać statusu setup");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  return (
    <main className="app">
      <h1>Hardware Registry</h1>
      <p>API URL: {apiBase}</p>
      {loading ? <p>Sprawdzanie statusu...</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading && !error && needsSetup ? <SetupAdminScreen onSetupDone={loadStatus} /> : null}
      {!loading && !error && !needsSetup ? <LoginPlaceholder /> : null}
    </main>
  );
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
