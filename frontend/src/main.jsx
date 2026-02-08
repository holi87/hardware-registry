import React, { useEffect, useMemo, useRef, useState } from "react";
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
  const [vlans, setVlans] = useState([]);
  const [vlansLoading, setVlansLoading] = useState(false);
  const [vlansError, setVlansError] = useState("");
  const [vlanSubmitting, setVlanSubmitting] = useState(false);
  const [newVlan, setNewVlan] = useState({ vlanId: "", name: "", notes: "" });
  const [wifiNetworks, setWifiNetworks] = useState([]);
  const [wifiLoading, setWifiLoading] = useState(false);
  const [wifiError, setWifiError] = useState("");
  const [wifiFilterSpaceId, setWifiFilterSpaceId] = useState("all");
  const [wifiSubmitting, setWifiSubmitting] = useState(false);
  const [newWifi, setNewWifi] = useState({
    ssid: "",
    password: "",
    security: "WPA2",
    spaceId: "",
    vlanId: "",
    notes: "",
  });
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const hideTimersRef = useRef(new Map());

  const isAdmin = me.role === "ADMIN";

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

  const loadVlans = async (rootId) => {
    if (!rootId) {
      setVlans([]);
      return;
    }

    setVlansLoading(true);
    setVlansError("");
    try {
      const { response, payload } = await request(`/vlans?root_id=${rootId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się pobrać listy VLAN", payload));
      }
      setVlans(payload || []);
    } catch (err) {
      setVlans([]);
      setVlansError(err.message || "Błąd pobierania VLAN");
    } finally {
      setVlansLoading(false);
    }
  };

  const clearRevealedPasswords = () => {
    for (const timeoutId of hideTimersRef.current.values()) {
      clearTimeout(timeoutId);
    }
    hideTimersRef.current.clear();
    setRevealedPasswords({});
  };

  const loadWifi = async (rootId) => {
    if (!rootId) {
      setWifiNetworks([]);
      return;
    }

    setWifiLoading(true);
    setWifiError("");
    try {
      const { response, payload } = await request(`/wifi?root_id=${rootId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się pobrać listy Wi-Fi", payload));
      }
      setWifiNetworks(payload || []);
    } catch (err) {
      setWifiNetworks([]);
      setWifiError(err.message || "Błąd pobierania Wi-Fi");
    } finally {
      setWifiLoading(false);
    }
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

  useEffect(() => {
    loadVlans(selectedRootId);
  }, [selectedRootId, accessToken]);

  useEffect(() => {
    clearRevealedPasswords();
    setWifiFilterSpaceId("all");
    setNewWifi((prev) => ({ ...prev, spaceId: "", vlanId: "" }));
    loadWifi(selectedRootId);
  }, [selectedRootId, accessToken]);

  useEffect(() => () => clearRevealedPasswords(), []);

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

  const spaces = useMemo(() => {
    const items = [];
    for (const node of maps.byId.values()) {
      if (selectedRootId && node.root_id !== selectedRootId) {
        continue;
      }
      items.push(node);
    }
    return items.sort((a, b) => a.name.localeCompare(b.name, "pl"));
  }, [maps, selectedRootId]);

  const filteredWifiNetworks = useMemo(() => {
    if (wifiFilterSpaceId === "all") {
      return wifiNetworks;
    }
    return wifiNetworks.filter((network) => network.space_id === wifiFilterSpaceId);
  }, [wifiNetworks, wifiFilterSpaceId]);

  useEffect(() => {
    if (!selectedRootId || spaces.length === 0) {
      return;
    }
    setNewWifi((prev) => {
      if (prev.spaceId && spaces.some((space) => space.id === prev.spaceId)) {
        return prev;
      }
      const fallbackId = spaces.find((space) => space.id === currentLocationId)?.id || spaces[0].id;
      return { ...prev, spaceId: fallbackId };
    });
  }, [selectedRootId, spaces, currentLocationId]);

  const onRootChange = (event) => {
    const rootId = event.target.value;
    setSelectedRootId(rootId);
    setCurrentLocationId(rootId);
  };

  const onCreateVlan = async (event) => {
    event.preventDefault();
    if (!selectedRootId) {
      return;
    }

    const parsedVlan = Number(newVlan.vlanId);
    if (!Number.isInteger(parsedVlan) || parsedVlan < 1 || parsedVlan > 4094) {
      setVlansError("VLAN ID musi być liczbą z zakresu 1-4094");
      return;
    }

    setVlanSubmitting(true);
    setVlansError("");
    try {
      const { response, payload } = await request("/vlans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          root_id: selectedRootId,
          vlan_id: parsedVlan,
          name: newVlan.name,
          notes: newVlan.notes || null,
        }),
      });

      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się utworzyć VLAN", payload));
      }

      setNewVlan({ vlanId: "", name: "", notes: "" });
      await loadVlans(selectedRootId);
    } catch (err) {
      setVlansError(err.message || "Błąd tworzenia VLAN");
    } finally {
      setVlanSubmitting(false);
    }
  };

  const onCreateWifi = async (event) => {
    event.preventDefault();
    if (!selectedRootId) {
      return;
    }
    if (!newWifi.spaceId) {
      setWifiError("Wybierz przestrzeń dla sieci Wi-Fi");
      return;
    }

    setWifiSubmitting(true);
    setWifiError("");
    try {
      const { response, payload } = await request("/wifi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          root_id: selectedRootId,
          space_id: newWifi.spaceId,
          ssid: newWifi.ssid,
          password: newWifi.password,
          security: newWifi.security,
          vlan_id: newWifi.vlanId || null,
          notes: newWifi.notes || null,
        }),
      });

      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się dodać sieci Wi-Fi", payload));
      }

      setNewWifi((prev) => ({
        ...prev,
        ssid: "",
        password: "",
        notes: "",
        vlanId: "",
      }));
      await loadWifi(selectedRootId);
    } catch (err) {
      setWifiError(err.message || "Błąd tworzenia Wi-Fi");
    } finally {
      setWifiSubmitting(false);
    }
  };

  const onRevealWifi = async (wifiId) => {
    setWifiError("");
    try {
      const { response, payload } = await request(`/wifi/${wifiId}/reveal`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się odsłonić hasła", payload));
      }

      if (hideTimersRef.current.has(wifiId)) {
        clearTimeout(hideTimersRef.current.get(wifiId));
      }

      setRevealedPasswords((prev) => ({ ...prev, [wifiId]: payload.password }));
      const timeoutId = setTimeout(() => {
        setRevealedPasswords((prev) => {
          const copy = { ...prev };
          delete copy[wifiId];
          return copy;
        });
        hideTimersRef.current.delete(wifiId);
      }, 30_000);
      hideTimersRef.current.set(wifiId, timeoutId);
    } catch (err) {
      setWifiError(err.message || "Błąd odsłaniania hasła");
    }
  };

  const onCopyPassword = async (wifiId) => {
    const value = revealedPasswords[wifiId];
    if (!value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
    } catch (_) {
      setWifiError("Nie udało się skopiować hasła");
    }
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

          <section className="subpanel">
            <h3>VLAN</h3>
            {vlansLoading ? <p>Ładowanie VLAN...</p> : null}
            {vlansError ? <p className="error">{vlansError}</p> : null}
            {!vlansLoading && !vlansError && vlans.length === 0 ? <p>Brak VLAN dla tego roota.</p> : null}
            {!vlansLoading && vlans.length > 0 ? (
              <ul className="simple-list">
                {vlans.map((vlan) => (
                  <li key={vlan.id}>
                    <strong>VLAN {vlan.vlan_id}</strong> - {vlan.name}
                    {vlan.notes ? <span className="muted"> ({vlan.notes})</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}

            {isAdmin ? (
              <form className="inline-form" onSubmit={onCreateVlan}>
                <h4>Dodaj VLAN</h4>
                <label htmlFor="vlan-id">VLAN ID</label>
                <input
                  id="vlan-id"
                  inputMode="numeric"
                  value={newVlan.vlanId}
                  onChange={(event) => setNewVlan((prev) => ({ ...prev, vlanId: event.target.value }))}
                  placeholder="10"
                  required
                />
                <label htmlFor="vlan-name">Nazwa</label>
                <input
                  id="vlan-name"
                  value={newVlan.name}
                  onChange={(event) => setNewVlan((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="LAN"
                  required
                />
                <label htmlFor="vlan-notes">Notatki</label>
                <input
                  id="vlan-notes"
                  value={newVlan.notes}
                  onChange={(event) => setNewVlan((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="opcjonalnie"
                />
                <button type="submit" disabled={vlanSubmitting}>
                  {vlanSubmitting ? "Zapisywanie..." : "Dodaj VLAN"}
                </button>
              </form>
            ) : null}
          </section>

          <section className="subpanel">
            <h3>Wi-Fi</h3>
            <div className="field">
              <label htmlFor="wifi-space-filter">Filtruj po przestrzeni</label>
              <select
                id="wifi-space-filter"
                value={wifiFilterSpaceId}
                onChange={(event) => setWifiFilterSpaceId(event.target.value)}
              >
                <option value="all">Wszystkie przestrzenie</option>
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </select>
            </div>

            {wifiLoading ? <p>Ładowanie Wi-Fi...</p> : null}
            {wifiError ? <p className="error">{wifiError}</p> : null}
            {!wifiLoading && filteredWifiNetworks.length === 0 ? <p>Brak sieci Wi-Fi w tym roocie.</p> : null}

            {!wifiLoading && filteredWifiNetworks.length > 0 ? (
              <div className="wifi-list">
                {filteredWifiNetworks.map((network) => {
                  const revealed = revealedPasswords[network.id];
                  const spaceName = maps.byId.get(network.space_id)?.name || "Nieznana przestrzeń";
                  return (
                    <article key={network.id} className="wifi-card">
                      <div>
                        <h4>{network.ssid}</h4>
                        <p className="muted">
                          {network.security} | {spaceName}
                        </p>
                      </div>
                      <p className="wifi-password">{revealed ? revealed : "••••••••••••"}</p>
                      <div className="wifi-actions">
                        <button type="button" onClick={() => onRevealWifi(network.id)}>
                          Pokaż hasło
                        </button>
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() => onCopyPassword(network.id)}
                          disabled={!revealed}
                        >
                          Kopiuj hasło
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}

            {isAdmin ? (
              <form className="inline-form" onSubmit={onCreateWifi}>
                <h4>Dodaj sieć Wi-Fi</h4>
                <label htmlFor="wifi-ssid">SSID</label>
                <input
                  id="wifi-ssid"
                  value={newWifi.ssid}
                  onChange={(event) => setNewWifi((prev) => ({ ...prev, ssid: event.target.value }))}
                  required
                />

                <label htmlFor="wifi-password">Hasło</label>
                <input
                  id="wifi-password"
                  type="password"
                  value={newWifi.password}
                  onChange={(event) => setNewWifi((prev) => ({ ...prev, password: event.target.value }))}
                  required
                />

                <label htmlFor="wifi-security">Security</label>
                <input
                  id="wifi-security"
                  value={newWifi.security}
                  onChange={(event) => setNewWifi((prev) => ({ ...prev, security: event.target.value }))}
                  required
                />

                <label htmlFor="wifi-space">Przestrzeń</label>
                <select
                  id="wifi-space"
                  value={newWifi.spaceId}
                  onChange={(event) => setNewWifi((prev) => ({ ...prev, spaceId: event.target.value }))}
                  required
                >
                  <option value="">Wybierz</option>
                  {spaces.map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.name}
                    </option>
                  ))}
                </select>

                <label htmlFor="wifi-vlan">VLAN (opcjonalnie)</label>
                <select
                  id="wifi-vlan"
                  value={newWifi.vlanId}
                  onChange={(event) => setNewWifi((prev) => ({ ...prev, vlanId: event.target.value }))}
                >
                  <option value="">Brak</option>
                  {vlans.map((vlan) => (
                    <option key={vlan.id} value={vlan.id}>
                      VLAN {vlan.vlan_id} - {vlan.name}
                    </option>
                  ))}
                </select>

                <label htmlFor="wifi-notes">Notatki</label>
                <input
                  id="wifi-notes"
                  value={newWifi.notes}
                  onChange={(event) => setNewWifi((prev) => ({ ...prev, notes: event.target.value }))}
                />

                <button type="submit" disabled={wifiSubmitting}>
                  {wifiSubmitting ? "Zapisywanie..." : "Dodaj Wi-Fi"}
                </button>
              </form>
            ) : null}
          </section>
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
