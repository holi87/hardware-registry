import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:8381/api").replace(/\/$/, "");
const ACCESS_KEY = "hardware_registry_access_token";
const REFRESH_KEY = "hardware_registry_refresh_token";

function parseApiError(fallback, payload) {
  if (!payload) {
    return fallback;
  }
  if (typeof payload.detail === "string") {
    return payload.detail;
  }
  return fallback;
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

function SetupAdminScreen({ onSetupDone }) {
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
      const { response, payload } = await request("/setup/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się utworzyć konta admina", payload));
      }

      onSetupDone();
    } catch (err) {
      setError(err.message || "Błąd podczas inicjalizacji");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel">
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
      const { response, payload } = await request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error(parseApiError("Błędny login lub hasło", payload));
      }

      localStorage.setItem(ACCESS_KEY, payload.access_token);
      localStorage.setItem(REFRESH_KEY, payload.refresh_token);
      onLoggedIn();
    } catch (err) {
      setError(err.message || "Błąd logowania");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel">
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

function ChangePasswordScreen({ me, onChanged }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    newPassword === confirmPassword;

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");

    try {
      const accessToken = localStorage.getItem(ACCESS_KEY);
      if (!accessToken) {
        throw new Error("Brak sesji użytkownika");
      }

      const { response, payload } = await request("/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });

      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się zmienić hasła", payload));
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setInfo("Hasło zostało zmienione.");
      setTimeout(onChanged, 300);
    } catch (err) {
      setError(err.message || "Błąd zmiany hasła");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel">
      <h2>Wymagana zmiana hasła</h2>
      <p className="warning">
        Użytkownik <strong>{me.email}</strong> musi zmienić hasło jednorazowe przed dalszą pracą.
      </p>
      <form onSubmit={onSubmit}>
        <label htmlFor="current-password">Aktualne hasło</label>
        <input
          id="current-password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />

        <label htmlFor="new-password">Nowe hasło</label>
        <input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Min. 12 znaków + złożoność"
          required
        />

        <label htmlFor="confirm-password">Powtórz nowe hasło</label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        <button type="submit" disabled={!canSubmit || loading}>
          {loading ? "Zapisywanie..." : "Zmień hasło"}
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {info ? <p className="info">{info}</p> : null}
    </section>
  );
}

function ExplorerScreen({ me, accessToken, onLogout }) {
  const [roots, setRoots] = useState([]);
  const [selectedRootId, setSelectedRootId] = useState("");
  const [tree, setTree] = useState(null);
  const [currentLocationId, setCurrentLocationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRoots = async () => {
    const { response, payload } = await request("/roots", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 401) {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
      onLogout();
      return [];
    }

    if (!response.ok) {
      throw new Error(parseApiError("Nie udało się pobrać rootów", payload));
    }

    return payload || [];
  };

  const loadTree = async (rootId) => {
    const { response, payload } = await request(`/locations/tree?root_id=${rootId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(parseApiError("Nie udało się pobrać drzewa lokalizacji", payload));
    }

    return payload;
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      setLoading(true);
      setError("");
      try {
        const rootsData = await loadRoots();
        if (!mounted) {
          return;
        }
        setRoots(rootsData);

        if (rootsData.length === 0) {
          setTree(null);
          setSelectedRootId("");
          setCurrentLocationId("");
          return;
        }

        const firstRootId = selectedRootId && rootsData.some((r) => r.id === selectedRootId) ? selectedRootId : rootsData[0].id;
        setSelectedRootId(firstRootId);
        const treeData = await loadTree(firstRootId);
        if (!mounted) {
          return;
        }
        setTree(treeData);
        setCurrentLocationId(firstRootId);
      } catch (err) {
        if (mounted) {
          setError(err.message || "Błąd ładowania danych");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!selectedRootId) {
      return;
    }

    let mounted = true;
    setError("");
    setLoading(true);

    loadTree(selectedRootId)
      .then((treeData) => {
        if (!mounted) {
          return;
        }
        setTree(treeData);
        setCurrentLocationId((prev) => {
          if (!prev) {
            return selectedRootId;
          }
          return prev;
        });
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || "Błąd ładowania drzewa");
          setTree(null);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [selectedRootId]);

  const maps = useMemo(() => {
    const byId = new Map();
    const parentById = new Map();

    const walk = (node, parentId = null) => {
      if (!node) {
        return;
      }
      byId.set(node.id, node);
      parentById.set(node.id, parentId);
      for (const child of node.children || []) {
        walk(child, node.id);
      }
    };

    walk(tree);
    return { byId, parentById };
  }, [tree]);

  useEffect(() => {
    if (!tree) {
      return;
    }
    if (!maps.byId.has(currentLocationId)) {
      setCurrentLocationId(tree.id);
    }
  }, [tree, currentLocationId, maps]);

  const currentNode = maps.byId.get(currentLocationId) || tree;
  const children = currentNode?.children || [];

  const breadcrumb = useMemo(() => {
    if (!currentNode) {
      return [];
    }
    const list = [];
    let pointer = currentNode.id;

    while (pointer) {
      const node = maps.byId.get(pointer);
      if (!node) {
        break;
      }
      list.push(node);
      pointer = maps.parentById.get(pointer) || null;
    }

    return list.reverse();
  }, [currentNode, maps]);

  const onRootChange = (event) => {
    const rootId = event.target.value;
    setSelectedRootId(rootId);
    setCurrentLocationId(rootId);
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Eksplorator przestrzeni</h2>
          <p className="muted">
            {me.email} ({me.role})
          </p>
        </div>
        <button type="button" className="button-secondary" onClick={onLogout}>
          Wyloguj
        </button>
      </div>

      {roots.length > 1 ? (
        <div className="field">
          <label htmlFor="root-selector">Root</label>
          <select id="root-selector" value={selectedRootId} onChange={onRootChange}>
            {roots.map((root) => (
              <option key={root.id} value={root.id}>
                {root.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {loading ? <p>Ładowanie przestrzeni...</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading && !error && roots.length === 0 ? <p>Brak przypisanych rootów.</p> : null}

      {!loading && !error && currentNode ? (
        <>
          <nav className="breadcrumb" aria-label="breadcrumb">
            {breadcrumb.map((node, index) => (
              <button
                key={node.id}
                type="button"
                className={`crumb ${node.id === currentNode.id ? "is-active" : ""}`}
                onClick={() => setCurrentLocationId(node.id)}
                disabled={node.id === currentNode.id}
              >
                {node.name}
                {index < breadcrumb.length - 1 ? " /" : ""}
              </button>
            ))}
          </nav>

          <header className="space-header">
            <h3>{currentNode.name}</h3>
            {currentNode.notes ? <p className="muted">{currentNode.notes}</p> : null}
          </header>

          <div className="tile-grid">
            {children.length === 0 ? <p>Brak podprzestrzeni.</p> : null}
            {children.map((child) => (
              <button key={child.id} type="button" className="tile" onClick={() => setCurrentLocationId(child.id)}>
                <span className="tile-title">{child.name}</span>
                <span className="tile-meta">Urządzenia: {child.device_count ?? 0}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
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

    const { response, payload } = await request("/auth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
      setMe(null);
      return;
    }

    setMe(payload);
  };

  const loadStatus = async () => {
    setLoading(true);
    setError("");

    try {
      const { response, payload } = await request("/setup/status");
      if (!response.ok) {
        throw new Error(parseApiError("Nie można pobrać statusu setup", payload));
      }

      const setupNeeded = Boolean(payload.needs_setup);
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
      <header className="app-header">
        <h1>Hardware Registry</h1>
        <p className="muted">API URL: {apiBase}</p>
      </header>

      {loading ? <p>Sprawdzanie statusu...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && !error && needsSetup ? <SetupAdminScreen onSetupDone={loadStatus} /> : null}
      {!loading && !error && !needsSetup && !me ? <LoginScreen onLoggedIn={fetchMe} /> : null}
      {!loading && !error && !needsSetup && me && me.must_change_password ? (
        <ChangePasswordScreen me={me} onChanged={fetchMe} />
      ) : null}
      {!loading && !error && !needsSetup && me && !me.must_change_password ? (
        <ExplorerScreen me={me} accessToken={localStorage.getItem(ACCESS_KEY)} onLogout={handleLogout} />
      ) : null}
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
