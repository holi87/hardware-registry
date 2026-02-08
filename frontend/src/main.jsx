import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:8381/api").replace(/\/$/, "");
const ACCESS_KEY = "hardware_registry_access_token";
const REFRESH_KEY = "hardware_registry_refresh_token";

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

function LoginScreen({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => email.trim().length > 3 && password.length > 0, [email, password]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || "Błędny login lub hasło");
      }

      localStorage.setItem(ACCESS_KEY, data.access_token);
      localStorage.setItem(REFRESH_KEY, data.refresh_token);
      onLoggedIn();
    } catch (err) {
      setError(err.message || "Błąd logowania");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h2>Logowanie</h2>
      <form onSubmit={onSubmit}>
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@hardware.local"
          required
        />

        <label htmlFor="login-password">Hasło</label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="********"
          required
        />

        <button type="submit" disabled={!canSubmit || loading}>
          {loading ? "Logowanie..." : "Zaloguj"}
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

function MeCard({ me, onLogout }) {
  return (
    <section>
      <h2>Zalogowano</h2>
      <div className="card">
        <p>
          <strong>Email:</strong> {me.email}
        </p>
        <p>
          <strong>Rola:</strong> {me.role}
        </p>
        <p>
          <strong>Aktywne:</strong> {String(me.is_active)}
        </p>
      </div>
      <button type="button" onClick={onLogout}>
        Wyloguj
      </button>
    </section>
  );
}

function App() {
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");

  const fetchMe = async () => {
    const accessToken = localStorage.getItem(ACCESS_KEY);
    if (!accessToken) {
      setMe(null);
      return;
    }

    const response = await fetch(`${apiBase}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
      setMe(null);
      return;
    }

    const payload = await response.json();
    setMe(payload);
  };

  const loadStatus = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${apiBase}/setup/status`);
      const data = await response.json();
      const setupNeeded = Boolean(data.needs_setup);
      setNeedsSetup(setupNeeded);

      if (!setupNeeded) {
        await fetchMe();
      } else {
        setMe(null);
      }
    } catch (err) {
      setError(err.message || "Nie można pobrać statusu setup");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    setMe(null);
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
      {!loading && !error && !needsSetup && !me ? <LoginScreen onLoggedIn={fetchMe} /> : null}
      {!loading && !error && !needsSetup && me ? <MeCard me={me} onLogout={handleLogout} /> : null}
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
