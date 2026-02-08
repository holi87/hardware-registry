import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  if (Array.isArray(payload.detail) && payload.detail.length > 0) {
    return payload.detail[0]?.msg || fallback;
  }
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    return payload.errors[0]?.msg || fallback;
  }
  return fallback;
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => null);
    return { response, payload };
  }
  return { response, payload: null };
}

async function requestBlob(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, options);
  const blob = await response.blob();
  return { response, blob };
}

function authHeaders(accessToken, extra = {}) {
  return {
    Authorization: `Bearer ${accessToken}`,
    ...extra,
  };
}

function SetupAdminScreen({ onSetupDone, notify }) {
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

      notify("Konto administratora zostało utworzone", "success");
      onSetupDone();
    } catch (err) {
      const message = err.message || "Błąd podczas inicjalizacji";
      setError(message);
      notify(message, "error");
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

function LoginScreen({ onLoggedIn, notify }) {
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
      notify("Logowanie zakończone sukcesem", "success");
      onLoggedIn();
    } catch (err) {
      const message = err.message || "Błąd logowania";
      setError(message);
      notify(message, "error");
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

function ChangePasswordScreen({ me, onChanged, notify }) {
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
        headers: authHeaders(accessToken, { "Content-Type": "application/json" }),
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });

      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się zmienić hasła", payload));
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      const successMessage = "Hasło zostało zmienione.";
      setInfo(successMessage);
      notify(successMessage, "success");
      setTimeout(onChanged, 300);
    } catch (err) {
      const message = err.message || "Błąd zmiany hasła";
      setError(message);
      notify(message, "error");
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

function flattenTree(node) {
  if (!node) {
    return [];
  }
  const result = [];
  const walk = (current, depth = 0) => {
    result.push({ ...current, depth });
    for (const child of current.children || []) {
      walk(child, depth + 1);
    }
  };
  walk(node, 0);
  return result;
}

function MenuButton({ active, onClick, children }) {
  return (
    <button type="button" className={`menu-btn ${active ? "active" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

function ExplorerScreen({ me, accessToken, onLogout, notify }) {
  const [activePage, setActivePage] = useState("roots");

  const [roots, setRoots] = useState([]);
  const [selectedRootId, setSelectedRootId] = useState("");
  const [spaces, setSpaces] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const lastErrorToastRef = useRef("");

  const [rootForm, setRootForm] = useState({ name: "", notes: "" });
  const [editingRootId, setEditingRootId] = useState("");
  const [rootEditForm, setRootEditForm] = useState({ name: "", notes: "" });
  const [spaceForm, setSpaceForm] = useState({ name: "", parentId: "", notes: "" });
  const [editingSpaceId, setEditingSpaceId] = useState("");
  const [spaceEditForm, setSpaceEditForm] = useState({ name: "", parentId: "", notes: "" });

  const [vlanList, setVlanList] = useState([]);
  const [vlanForm, setVlanForm] = useState({
    vlanId: "",
    name: "",
    subnetMask: "255.255.255.0",
    ipRangeStart: "",
    ipRangeEnd: "",
    notes: "",
  });
  const [editingVlanId, setEditingVlanId] = useState("");
  const [vlanEditForm, setVlanEditForm] = useState({
    vlanId: "",
    name: "",
    subnetMask: "",
    ipRangeStart: "",
    ipRangeEnd: "",
    notes: "",
  });

  const [wifiList, setWifiList] = useState([]);
  const [wifiForm, setWifiForm] = useState({
    spaceId: "",
    ssid: "",
    password: "",
    security: "WPA2",
    vlanId: "",
    notes: "",
  });
  const [editingWifiId, setEditingWifiId] = useState("");
  const [wifiEditForm, setWifiEditForm] = useState({
    spaceId: "",
    ssid: "",
    password: "",
    security: "",
    vlanId: "",
    notes: "",
  });
  const [wifiSpaceFilter, setWifiSpaceFilter] = useState("all");
  const [revealedWifiPasswords, setRevealedWifiPasswords] = useState({});
  const revealTimersRef = useRef(new Map());

  const [deviceList, setDeviceList] = useState([]);
  const [deviceSpaceFilter, setDeviceSpaceFilter] = useState("all");
  const [deviceForm, setDeviceForm] = useState({
    spaceId: "",
    name: "",
    type: "",
    vendor: "",
    model: "",
    serial: "",
    notes: "",
    isReceiver: false,
    supportsWifi: false,
    supportsEthernet: false,
    supportsZigbee: false,
    supportsMatterThread: false,
    supportsBluetooth: false,
    supportsBle: false,
  });
  const [editingDeviceId, setEditingDeviceId] = useState("");
  const [deviceEditForm, setDeviceEditForm] = useState({
    spaceId: "",
    name: "",
    type: "",
    vendor: "",
    model: "",
    serial: "",
    notes: "",
    isReceiver: false,
    supportsWifi: false,
    supportsEthernet: false,
    supportsZigbee: false,
    supportsMatterThread: false,
    supportsBluetooth: false,
    supportsBle: false,
  });

  const [users, setUsers] = useState([]);
  const [userDrafts, setUserDrafts] = useState({});
  const [passwordDrafts, setPasswordDrafts] = useState({});
  const [userForm, setUserForm] = useState({
    email: "",
    password: "",
    role: "USER",
    isActive: true,
    rootIds: [],
  });

  const [topologyUrl, setTopologyUrl] = useState("");
  const [topologyLoading, setTopologyLoading] = useState(false);

  const isAdmin = me.role === "ADMIN";

  const selectedRoot = useMemo(() => roots.find((item) => item.id === selectedRootId) || null, [roots, selectedRootId]);

  const spaceOptions = useMemo(() => {
    return spaces.map((space) => ({
      ...space,
      label: `${"\u00A0\u00A0".repeat(space.depth || 0)}${space.name}`,
    }));
  }, [spaces]);

  const filteredWifi = useMemo(() => {
    if (wifiSpaceFilter === "all") {
      return wifiList;
    }
    return wifiList.filter((item) => item.space_id === wifiSpaceFilter);
  }, [wifiList, wifiSpaceFilter]);

  const filteredDevices = useMemo(() => {
    if (deviceSpaceFilter === "all") {
      return deviceList;
    }
    return deviceList.filter((item) => item.space_id === deviceSpaceFilter);
  }, [deviceList, deviceSpaceFilter]);

  const clearRevealedWifi = () => {
    for (const timerId of revealTimersRef.current.values()) {
      clearTimeout(timerId);
    }
    revealTimersRef.current.clear();
    setRevealedWifiPasswords({});
  };

  const loadRoots = async () => {
    const { response, payload } = await request("/roots", {
      headers: authHeaders(accessToken),
    });
    if (!response.ok) {
      throw new Error(parseApiError("Nie udało się pobrać rootów", payload));
    }
    const list = payload || [];
    setRoots(list);
    setSelectedRootId((prev) => {
      if (prev && list.some((item) => item.id === prev)) {
        return prev;
      }
      return list[0]?.id || "";
    });
    return list;
  };

  const loadSpaces = async (rootId) => {
    if (!rootId) {
      setSpaces([]);
      return [];
    }

    const { response, payload } = await request(`/locations/tree?root_id=${rootId}`, {
      headers: authHeaders(accessToken),
    });

    if (!response.ok) {
      throw new Error(parseApiError("Nie udało się pobrać przestrzeni", payload));
    }

    const flattened = flattenTree(payload);
    setSpaces(flattened);

    setSpaceForm((prev) => ({
      ...prev,
      parentId: prev.parentId && flattened.some((space) => space.id === prev.parentId) ? prev.parentId : rootId,
    }));
    setWifiForm((prev) => ({
      ...prev,
      spaceId: prev.spaceId && flattened.some((space) => space.id === prev.spaceId) ? prev.spaceId : rootId,
    }));
    setDeviceForm((prev) => ({
      ...prev,
      spaceId: prev.spaceId && flattened.some((space) => space.id === prev.spaceId) ? prev.spaceId : rootId,
    }));

    return flattened;
  };

  const loadVlans = async (rootId) => {
    if (!rootId) {
      setVlanList([]);
      return;
    }
    const { response, payload } = await request(`/vlans?root_id=${rootId}`, {
      headers: authHeaders(accessToken),
    });
    if (!response.ok) {
      throw new Error(parseApiError("Nie udało się pobrać VLAN", payload));
    }
    setVlanList(payload || []);
    setWifiForm((prev) => ({
      ...prev,
      vlanId: prev.vlanId && (payload || []).some((vlan) => vlan.id === prev.vlanId) ? prev.vlanId : "",
    }));
  };

  const loadWifi = async (rootId) => {
    if (!rootId) {
      setWifiList([]);
      return;
    }
    const { response, payload } = await request(`/wifi?root_id=${rootId}`, {
      headers: authHeaders(accessToken),
    });
    if (!response.ok) {
      throw new Error(parseApiError("Nie udało się pobrać Wi-Fi", payload));
    }
    setWifiList(payload || []);
  };

  const loadDevices = async (rootId) => {
    if (!rootId) {
      setDeviceList([]);
      return;
    }
    const { response, payload } = await request(`/devices?root_id=${rootId}`, {
      headers: authHeaders(accessToken),
    });
    if (!response.ok) {
      throw new Error(parseApiError("Nie udało się pobrać urządzeń", payload));
    }
    setDeviceList(payload || []);
  };

  const loadUsers = async () => {
    if (!isAdmin) {
      setUsers([]);
      setUserDrafts({});
      return;
    }
    const { response, payload } = await request("/admin/users", {
      headers: authHeaders(accessToken),
    });
    if (!response.ok) {
      throw new Error(parseApiError("Nie udało się pobrać użytkowników", payload));
    }
    const list = payload || [];
    setUsers(list);
    const drafts = {};
    list.forEach((user) => {
      drafts[user.id] = {
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        root_ids: user.root_ids || [],
      };
    });
    setUserDrafts(drafts);
  };

  const refreshAllForRoot = async (rootId) => {
    if (!rootId) {
      return;
    }
    await Promise.all([loadSpaces(rootId), loadVlans(rootId), loadWifi(rootId), loadDevices(rootId)]);
  };

  useEffect(() => {
    if (!error) {
      lastErrorToastRef.current = "";
      return;
    }
    if (lastErrorToastRef.current === error) {
      return;
    }
    lastErrorToastRef.current = error;
    notify(error, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, notify]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    loadRoots()
      .then(async (list) => {
        if (!mounted) {
          return;
        }
        const firstRoot = list[0]?.id || "";
        if (firstRoot) {
          await refreshAllForRoot(firstRoot);
        }
        await loadUsers();
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || "Błąd ładowania danych");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
      clearRevealedWifi();
      if (topologyUrl) {
        URL.revokeObjectURL(topologyUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    if (!selectedRootId) {
      return;
    }
    setError("");
    setEditingRootId("");
    setEditingVlanId("");
    setEditingWifiId("");
    setEditingDeviceId("");
    setEditingSpaceId("");
    refreshAllForRoot(selectedRootId).catch((err) => setError(err.message || "Błąd odświeżania danych"));
    if (topologyUrl) {
      URL.revokeObjectURL(topologyUrl);
      setTopologyUrl("");
    }
    clearRevealedWifi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRootId]);

  useEffect(() => {
    loadUsers().catch((err) => setError(err.message || "Błąd ładowania użytkowników"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        clearRevealedWifi();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const onRootChange = (event) => {
    setSelectedRootId(event.target.value);
  };

  const onCreateRoot = async (event) => {
    event.preventDefault();
    if (!isAdmin) {
      return;
    }
    setError("");
    try {
      const { response, payload } = await request("/roots", {
        method: "POST",
        headers: authHeaders(accessToken, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          name: rootForm.name,
          notes: rootForm.notes || null,
        }),
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się utworzyć roota", payload));
      }
      setRootForm({ name: "", notes: "" });
      await loadRoots();
      await loadUsers();
      notify("Root został utworzony");
    } catch (err) {
      setError(err.message || "Błąd tworzenia roota");
    }
  };

  const onStartEditRoot = (root) => {
    setEditingRootId(root.id);
    setRootEditForm({
      name: root.name || "",
      notes: root.notes || "",
    });
  };

  const onSaveRoot = async (rootId) => {
    if (!isAdmin) {
      return;
    }
    setError("");
    try {
      const { response, payload } = await request(`/roots/${rootId}`, {
        method: "PATCH",
        headers: authHeaders(accessToken, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          name: rootEditForm.name,
          notes: rootEditForm.notes || null,
        }),
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się zaktualizować roota", payload));
      }
      setEditingRootId("");
      await loadRoots();
      await loadUsers();
      notify("Root zaktualizowany");
    } catch (err) {
      setError(err.message || "Błąd edycji roota");
    }
  };

  const onDeleteRoot = async (rootId) => {
    if (!isAdmin) {
      return;
    }
    const confirmed = window.confirm("Usunąć ten root?");
    if (!confirmed) {
      return;
    }

    setError("");
    try {
      const { response, payload } = await request(`/roots/${rootId}`, {
        method: "DELETE",
        headers: authHeaders(accessToken),
      });
      if (!response.ok && response.status !== 204) {
        throw new Error(parseApiError("Nie udało się usunąć roota", payload));
      }

      await loadRoots();
      await loadUsers();
      notify("Root został usunięty");
    } catch (err) {
      setError(err.message || "Błąd usuwania roota");
    }
  };

  const onCreateSpace = async (event) => {
    event.preventDefault();
    if (!isAdmin || !selectedRootId) {
      return;
    }
    setError("");
    try {
      const { response, payload } = await request("/locations", {
        method: "POST",
        headers: authHeaders(accessToken, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          name: spaceForm.name,
          root_id: selectedRootId,
          parent_id: spaceForm.parentId || selectedRootId,
          notes: spaceForm.notes || null,
        }),
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się utworzyć przestrzeni", payload));
      }
      setSpaceForm((prev) => ({ ...prev, name: "", notes: "" }));
      await loadSpaces(selectedRootId);
      notify("Przestrzeń została utworzona");
    } catch (err) {
      setError(err.message || "Błąd tworzenia przestrzeni");
    }
  };

  const onStartEditSpace = (space) => {
    setEditingSpaceId(space.id);
    setSpaceEditForm({
      name: space.name || "",
      parentId: space.parent_id || selectedRootId,
      notes: space.notes || "",
    });
  };

  const onSaveSpace = async (spaceId) => {
    if (!isAdmin || !selectedRootId) {
      return;
    }
    if (!spaceEditForm.parentId) {
      setError("Przestrzeń musi mieć parent");
      return;
    }
    setError("");
    try {
      const { response, payload } = await request(`/locations/${spaceId}`, {
        method: "PATCH",
        headers: authHeaders(accessToken, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          name: spaceEditForm.name,
          parent_id: spaceEditForm.parentId,
          notes: spaceEditForm.notes || null,
        }),
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się zaktualizować przestrzeni", payload));
      }
      setEditingSpaceId("");
      await loadSpaces(selectedRootId);
      notify("Przestrzeń zaktualizowana");
    } catch (err) {
      setError(err.message || "Błąd edycji przestrzeni");
    }
  };

  const onCreateVlan = async (event) => {
    event.preventDefault();
    if (!isAdmin || !selectedRootId) {
      return;
    }

    const vlanId = Number(vlanForm.vlanId);
    if (!Number.isInteger(vlanId) || vlanId < 1 || vlanId > 4094) {
      setError("VLAN ID musi być liczbą 1-4094");
      return;
    }

    setError("");
    try {
      const { response, payload } = await request("/vlans", {
        method: "POST",
        headers: authHeaders(accessToken, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          root_id: selectedRootId,
          vlan_id: vlanId,
          name: vlanForm.name,
          subnet_mask: vlanForm.subnetMask,
          ip_range_start: vlanForm.ipRangeStart,
          ip_range_end: vlanForm.ipRangeEnd,
          notes: vlanForm.notes || null,
        }),
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się zapisać VLAN", payload));
      }

      setVlanForm({
        vlanId: "",
        name: "",
        subnetMask: "255.255.255.0",
        ipRangeStart: "",
        ipRangeEnd: "",
        notes: "",
      });
      await loadVlans(selectedRootId);
      notify("VLAN zapisany poprawnie");
    } catch (err) {
      setError(err.message || "Błąd zapisu VLAN");
    }
  };

  const onCreateWifi = async (event) => {
    event.preventDefault();
    if (!isAdmin || !selectedRootId) {
      return;
    }
    if (!wifiForm.spaceId || !wifiForm.vlanId) {
      setError("Wi-Fi wymaga przestrzeni i VLAN");
      return;
    }

    setError("");
    try {
      const { response, payload } = await request("/wifi", {
        method: "POST",
        headers: authHeaders(accessToken, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          root_id: selectedRootId,
          space_id: wifiForm.spaceId,
          ssid: wifiForm.ssid,
          password: wifiForm.password,
          security: wifiForm.security,
          vlan_id: wifiForm.vlanId,
          notes: wifiForm.notes || null,
        }),
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się zapisać Wi-Fi", payload));
      }

      setWifiForm((prev) => ({ ...prev, ssid: "", password: "", notes: "" }));
      await loadWifi(selectedRootId);
      notify("Wi-Fi zapisane poprawnie");
    } catch (err) {
      setError(err.message || "Błąd zapisu Wi-Fi");
    }
  };

  const onRevealWifi = async (wifiId) => {
    setError("");
    try {
      const { response, payload } = await request(`/wifi/${wifiId}/reveal`, {
        method: "POST",
        headers: authHeaders(accessToken),
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się odsłonić hasła", payload));
      }

      if (revealTimersRef.current.has(wifiId)) {
        clearTimeout(revealTimersRef.current.get(wifiId));
      }

      setRevealedWifiPasswords((prev) => ({ ...prev, [wifiId]: payload.password }));
      const timeoutId = setTimeout(() => {
        setRevealedWifiPasswords((prev) => {
          const copy = { ...prev };
          delete copy[wifiId];
          return copy;
        });
        revealTimersRef.current.delete(wifiId);
      }, 30_000);
      revealTimersRef.current.set(wifiId, timeoutId);
      notify("Hasło odsłonięte na 30 sekund");
    } catch (err) {
      setError(err.message || "Błąd reveal hasła Wi-Fi");
    }
  };

  const onCreateDevice = async (event) => {
    event.preventDefault();
    if (!isAdmin || !selectedRootId) {
      return;
    }
    if (!deviceForm.spaceId) {
      setError("Wybierz przestrzeń dla urządzenia");
      return;
    }

    setError("");
    try {
      const { response, payload } = await request("/devices", {
        method: "POST",
        headers: authHeaders(accessToken, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          root_id: selectedRootId,
          space_id: deviceForm.spaceId,
          name: deviceForm.name,
          type: deviceForm.type,
          vendor: deviceForm.vendor || null,
          model: deviceForm.model || null,
          serial: deviceForm.serial || null,
          notes: deviceForm.notes || null,
          is_receiver: deviceForm.isReceiver,
          supports_wifi: deviceForm.supportsWifi,
          supports_ethernet: deviceForm.supportsEthernet,
          supports_zigbee: deviceForm.supportsZigbee,
          supports_matter_thread: deviceForm.supportsMatterThread,
          supports_bluetooth: deviceForm.supportsBluetooth,
          supports_ble: deviceForm.supportsBle,
        }),
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się zapisać urządzenia", payload));
      }

      setDeviceForm((prev) => ({
        ...prev,
        name: "",
        type: "",
        vendor: "",
        model: "",
        serial: "",
        notes: "",
      }));
      await loadDevices(selectedRootId);
      notify("Urządzenie zapisane poprawnie");
    } catch (err) {
      setError(err.message || "Błąd zapisu urządzenia");
    }
  };

  const onStartEditVlan = (vlan) => {
    setEditingVlanId(vlan.id);
    setVlanEditForm({
      vlanId: String(vlan.vlan_id),
      name: vlan.name || "",
      subnetMask: vlan.subnet_mask || "",
      ipRangeStart: vlan.ip_range_start || "",
      ipRangeEnd: vlan.ip_range_end || "",
      notes: vlan.notes || "",
    });
  };

  const onSaveVlan = async (vlanId) => {
    if (!isAdmin || !selectedRootId) {
      return;
    }
    const parsedVlanId = Number(vlanEditForm.vlanId);
    if (!Number.isInteger(parsedVlanId) || parsedVlanId < 1 || parsedVlanId > 4094) {
      setError("VLAN ID musi być liczbą 1-4094");
      return;
    }

    setError("");
    try {
      const { response, payload } = await request(`/vlans/${vlanId}`, {
        method: "PATCH",
        headers: authHeaders(accessToken, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          vlan_id: parsedVlanId,
          name: vlanEditForm.name,
          subnet_mask: vlanEditForm.subnetMask,
          ip_range_start: vlanEditForm.ipRangeStart,
          ip_range_end: vlanEditForm.ipRangeEnd,
          notes: vlanEditForm.notes || null,
        }),
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się zaktualizować VLAN", payload));
      }
      setEditingVlanId("");
      await loadVlans(selectedRootId);
      notify("VLAN zaktualizowany");
    } catch (err) {
      setError(err.message || "Błąd edycji VLAN");
    }
  };

  const onDeleteVlan = async (vlanId) => {
    if (!isAdmin || !selectedRootId) {
      return;
    }
    if (!window.confirm("Usunąć VLAN?")) {
      return;
    }
    setError("");
    try {
      const { response, payload } = await request(`/vlans/${vlanId}`, {
        method: "DELETE",
        headers: authHeaders(accessToken),
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się usunąć VLAN", payload));
      }
      if (editingVlanId === vlanId) {
        setEditingVlanId("");
      }
      await loadVlans(selectedRootId);
      await loadWifi(selectedRootId);
      notify("VLAN usunięty");
    } catch (err) {
      setError(err.message || "Błąd usuwania VLAN");
    }
  };

  const onStartEditWifi = (wifi) => {
    setEditingWifiId(wifi.id);
    setWifiEditForm({
      spaceId: wifi.space_id || "",
      ssid: wifi.ssid || "",
      password: "",
      security: wifi.security || "",
      vlanId: wifi.vlan_id || "",
      notes: wifi.notes || "",
    });
  };

  const onSaveWifi = async (wifiId) => {
    if (!isAdmin || !selectedRootId) {
      return;
    }
    if (!wifiEditForm.spaceId || !wifiEditForm.vlanId) {
      setError("Wi-Fi wymaga przestrzeni i VLAN");
      return;
    }

    const body = {
      space_id: wifiEditForm.spaceId,
      ssid: wifiEditForm.ssid,
      security: wifiEditForm.security,
      vlan_id: wifiEditForm.vlanId,
      notes: wifiEditForm.notes || null,
    };
    if (wifiEditForm.password.trim().length > 0) {
      body.password = wifiEditForm.password;
    }

    setError("");
    try {
      const { response, payload } = await request(`/wifi/${wifiId}`, {
        method: "PATCH",
        headers: authHeaders(accessToken, { "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się zaktualizować Wi-Fi", payload));
      }
      setEditingWifiId("");
      await loadWifi(selectedRootId);
      notify("Wi-Fi zaktualizowane");
    } catch (err) {
      setError(err.message || "Błąd edycji Wi-Fi");
    }
  };

  const onDeleteWifi = async (wifiId) => {
    if (!isAdmin || !selectedRootId) {
      return;
    }
    if (!window.confirm("Usunąć sieć Wi-Fi?")) {
      return;
    }
    setError("");
    try {
      const { response, payload } = await request(`/wifi/${wifiId}`, {
        method: "DELETE",
        headers: authHeaders(accessToken),
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się usunąć Wi-Fi", payload));
      }
      if (editingWifiId === wifiId) {
        setEditingWifiId("");
      }
      await loadWifi(selectedRootId);
      notify("Wi-Fi usunięte");
    } catch (err) {
      setError(err.message || "Błąd usuwania Wi-Fi");
    }
  };

  const onStartEditDevice = (device) => {
    setEditingDeviceId(device.id);
    setDeviceEditForm({
      spaceId: device.space_id || "",
      name: device.name || "",
      type: device.type || "",
      vendor: device.vendor || "",
      model: device.model || "",
      serial: device.serial || "",
      notes: device.notes || "",
      isReceiver: Boolean(device.is_receiver),
      supportsWifi: Boolean(device.supports_wifi),
      supportsEthernet: Boolean(device.supports_ethernet),
      supportsZigbee: Boolean(device.supports_zigbee),
      supportsMatterThread: Boolean(device.supports_matter_thread),
      supportsBluetooth: Boolean(device.supports_bluetooth),
      supportsBle: Boolean(device.supports_ble),
    });
  };

  const onSaveDevice = async (deviceId) => {
    if (!isAdmin || !selectedRootId) {
      return;
    }
    if (!deviceEditForm.spaceId) {
      setError("Wybierz przestrzeń dla urządzenia");
      return;
    }

    setError("");
    try {
      const { response, payload } = await request(`/devices/${deviceId}`, {
        method: "PATCH",
        headers: authHeaders(accessToken, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          space_id: deviceEditForm.spaceId,
          name: deviceEditForm.name,
          type: deviceEditForm.type,
          vendor: deviceEditForm.vendor || null,
          model: deviceEditForm.model || null,
          serial: deviceEditForm.serial || null,
          notes: deviceEditForm.notes || null,
          is_receiver: deviceEditForm.isReceiver,
          supports_wifi: deviceEditForm.supportsWifi,
          supports_ethernet: deviceEditForm.supportsEthernet,
          supports_zigbee: deviceEditForm.supportsZigbee,
          supports_matter_thread: deviceEditForm.supportsMatterThread,
          supports_bluetooth: deviceEditForm.supportsBluetooth,
          supports_ble: deviceEditForm.supportsBle,
        }),
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się zaktualizować urządzenia", payload));
      }
      setEditingDeviceId("");
      await loadDevices(selectedRootId);
      notify("Urządzenie zaktualizowane");
    } catch (err) {
      setError(err.message || "Błąd edycji urządzenia");
    }
  };

  const onDeleteDevice = async (deviceId) => {
    if (!isAdmin || !selectedRootId) {
      return;
    }
    if (!window.confirm("Usunąć urządzenie?")) {
      return;
    }
    setError("");
    try {
      const { response, payload } = await request(`/devices/${deviceId}`, {
        method: "DELETE",
        headers: authHeaders(accessToken),
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się usunąć urządzenia", payload));
      }
      if (editingDeviceId === deviceId) {
        setEditingDeviceId("");
      }
      await loadDevices(selectedRootId);
      notify("Urządzenie usunięte");
    } catch (err) {
      setError(err.message || "Błąd usuwania urządzenia");
    }
  };

  const onGenerateTopology = async () => {
    if (!selectedRootId) {
      return;
    }
    setTopologyLoading(true);
    setError("");
    try {
      const { response, blob } = await requestBlob(`/topology/png?root_id=${selectedRootId}`, {
        headers: authHeaders(accessToken),
      });
      if (!response.ok) {
        const text = await blob.text().catch(() => "");
        throw new Error(text || "Nie udało się wygenerować PNG topologii");
      }

      if (topologyUrl) {
        URL.revokeObjectURL(topologyUrl);
      }
      const url = URL.createObjectURL(blob);
      setTopologyUrl(url);
      notify("Wygenerowano PNG topologii");
    } catch (err) {
      setError(err.message || "Błąd generowania topologii");
    } finally {
      setTopologyLoading(false);
    }
  };

  const onCreateUser = async (event) => {
    event.preventDefault();
    if (!isAdmin) {
      return;
    }

    const rootIds = userForm.role === "USER" ? userForm.rootIds : userForm.rootIds;
    if (userForm.role === "USER" && rootIds.length === 0) {
      setError("USER musi mieć przypisany co najmniej jeden root");
      return;
    }

    setError("");
    try {
      const { response, payload } = await request("/admin/users", {
        method: "POST",
        headers: authHeaders(accessToken, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          email: userForm.email,
          password: userForm.password,
          role: userForm.role,
          is_active: userForm.isActive,
          root_ids: rootIds,
        }),
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się utworzyć użytkownika", payload));
      }

      setUserForm({ email: "", password: "", role: "USER", isActive: true, rootIds: [] });
      await loadUsers();
      notify("Użytkownik został utworzony");
    } catch (err) {
      setError(err.message || "Błąd tworzenia użytkownika");
    }
  };

  const onSaveUser = async (userId) => {
    if (!isAdmin) {
      return;
    }
    const draft = userDrafts[userId];
    if (!draft) {
      return;
    }
    if (draft.role === "USER" && (!draft.root_ids || draft.root_ids.length === 0)) {
      setError("USER musi mieć przypisany co najmniej jeden root");
      return;
    }

    setError("");
    try {
      const { response, payload } = await request(`/admin/users/${userId}`, {
        method: "PATCH",
        headers: authHeaders(accessToken, { "Content-Type": "application/json" }),
        body: JSON.stringify(draft),
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się zapisać użytkownika", payload));
      }
      await loadUsers();
      notify("Zmiany użytkownika zapisane");
    } catch (err) {
      setError(err.message || "Błąd zapisu użytkownika");
    }
  };

  const onSetUserPassword = async (userId) => {
    if (!isAdmin) {
      return;
    }
    const password = passwordDrafts[userId] || "";
    if (!password) {
      setError("Podaj nowe hasło");
      return;
    }

    setError("");
    try {
      const { response, payload } = await request(`/admin/users/${userId}/set-password`, {
        method: "POST",
        headers: authHeaders(accessToken, { "Content-Type": "application/json" }),
        body: JSON.stringify({ password, must_change_password: true }),
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się ustawić hasła", payload));
      }
      setPasswordDrafts((prev) => ({ ...prev, [userId]: "" }));
      await loadUsers();
      notify("Hasło użytkownika zostało zmienione");
    } catch (err) {
      setError(err.message || "Błąd ustawiania hasła");
    }
  };

  const renderRootsPage = () => {
    const nonRootSpaces = spaces.filter((space) => space.id !== selectedRootId);

    return (
      <section className="subpanel page-panel">
        <h3>Rooty i przestrzenie</h3>
        <p className="muted">Zarządzanie root lokalizacjami oraz podprzestrzeniami (tylko ADMIN).</p>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Root</th>
                <th>Notatki</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {roots.length === 0 ? (
                <tr>
                  <td colSpan={3}>Brak rootów</td>
                </tr>
              ) : (
                roots.map((root) => {
                  const isEditingRoot = isAdmin && editingRootId === root.id;
                  return (
                    <React.Fragment key={root.id}>
                      <tr>
                        <td>
                          <button
                            type="button"
                            className={`link-btn ${selectedRootId === root.id ? "active" : ""}`}
                            onClick={() => setSelectedRootId(root.id)}
                          >
                            {root.name}
                          </button>
                        </td>
                        <td>{root.notes || "-"}</td>
                        <td>
                          {isAdmin ? (
                            <div className="table-actions">
                              <button type="button" className="button-secondary" onClick={() => onStartEditRoot(root)}>
                                {isEditingRoot ? "Edytujesz" : "Edytuj"}
                              </button>
                              <button type="button" className="button-danger" onClick={() => onDeleteRoot(root.id)}>
                                Usuń root
                              </button>
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                      {isEditingRoot ? (
                        <tr className="edit-row">
                          <td colSpan={3}>
                            <form
                              className="inline-form compact-form"
                              onSubmit={(event) => {
                                event.preventDefault();
                                onSaveRoot(root.id);
                              }}
                            >
                              <h4>Edycja roota</h4>
                              <div className="edit-grid">
                                <div>
                                  <label htmlFor={`root-edit-name-${root.id}`}>Nazwa</label>
                                  <input
                                    id={`root-edit-name-${root.id}`}
                                    value={rootEditForm.name}
                                    onChange={(event) => setRootEditForm((prev) => ({ ...prev, name: event.target.value }))}
                                    required
                                  />
                                </div>
                                <div>
                                  <label htmlFor={`root-edit-notes-${root.id}`}>Notatki</label>
                                  <input
                                    id={`root-edit-notes-${root.id}`}
                                    value={rootEditForm.notes}
                                    onChange={(event) => setRootEditForm((prev) => ({ ...prev, notes: event.target.value }))}
                                  />
                                </div>
                              </div>
                              <div className="table-actions">
                                <button type="submit">Zapisz</button>
                                <button type="button" className="button-secondary" onClick={() => setEditingRootId("")}>
                                  Anuluj
                                </button>
                              </div>
                            </form>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {selectedRootId ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Przestrzeń</th>
                  <th>Parent</th>
                  <th>Urządzenia</th>
                  <th>Notatki</th>
                  <th>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {nonRootSpaces.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Brak podprzestrzeni dla wybranego roota</td>
                  </tr>
                ) : (
                  nonRootSpaces.map((space) => {
                    const parent = spaces.find((node) => node.id === space.parent_id);
                    const isEditingSpace = isAdmin && editingSpaceId === space.id;
                    const allowedParents = spaces.filter((node) => node.id !== space.id);
                    return (
                      <React.Fragment key={space.id}>
                        <tr>
                          <td>{`${"\u00A0\u00A0".repeat(space.depth || 0)}${space.name}`}</td>
                          <td>{parent?.name || "-"}</td>
                          <td>{space.device_count || 0}</td>
                          <td>{space.notes || "-"}</td>
                          <td>
                            {isAdmin ? (
                              <button type="button" className="button-secondary" onClick={() => onStartEditSpace(space)}>
                                {isEditingSpace ? "Edytujesz" : "Edytuj"}
                              </button>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                        {isEditingSpace ? (
                          <tr className="edit-row">
                            <td colSpan={5}>
                              <form
                                className="inline-form compact-form"
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  onSaveSpace(space.id);
                                }}
                              >
                                <h4>Edycja przestrzeni</h4>
                                <div className="edit-grid">
                                  <div>
                                    <label htmlFor={`space-edit-name-${space.id}`}>Nazwa</label>
                                    <input
                                      id={`space-edit-name-${space.id}`}
                                      value={spaceEditForm.name}
                                      onChange={(event) =>
                                        setSpaceEditForm((prev) => ({ ...prev, name: event.target.value }))
                                      }
                                      required
                                    />
                                  </div>
                                  <div>
                                    <label htmlFor={`space-edit-parent-${space.id}`}>Parent</label>
                                    <select
                                      id={`space-edit-parent-${space.id}`}
                                      value={spaceEditForm.parentId}
                                      onChange={(event) =>
                                        setSpaceEditForm((prev) => ({ ...prev, parentId: event.target.value }))
                                      }
                                      required
                                    >
                                      {allowedParents.map((node) => (
                                        <option key={`${space.id}-${node.id}`} value={node.id}>
                                          {`${"\u00A0\u00A0".repeat(node.depth || 0)}${node.name}`}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="span-2">
                                    <label htmlFor={`space-edit-notes-${space.id}`}>Notatki</label>
                                    <input
                                      id={`space-edit-notes-${space.id}`}
                                      value={spaceEditForm.notes}
                                      onChange={(event) =>
                                        setSpaceEditForm((prev) => ({ ...prev, notes: event.target.value }))
                                      }
                                    />
                                  </div>
                                </div>
                                <div className="table-actions">
                                  <button type="submit">Zapisz</button>
                                  <button type="button" className="button-secondary" onClick={() => setEditingSpaceId("")}>
                                    Anuluj
                                  </button>
                                </div>
                              </form>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : null}

        {isAdmin ? (
          <>
            <form className="inline-form" onSubmit={onCreateRoot}>
              <h4>Dodaj root</h4>
              <label htmlFor="root-name">Nazwa</label>
              <input
                id="root-name"
                value={rootForm.name}
                onChange={(event) => setRootForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
              <label htmlFor="root-notes">Notatki</label>
              <input
                id="root-notes"
                value={rootForm.notes}
                onChange={(event) => setRootForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
              <button type="submit">Dodaj root</button>
            </form>

            {selectedRootId ? (
              <form className="inline-form" onSubmit={onCreateSpace}>
                <h4>Dodaj przestrzeń (root: {selectedRoot?.name || selectedRootId})</h4>
                <label htmlFor="space-name">Nazwa</label>
                <input
                  id="space-name"
                  value={spaceForm.name}
                  onChange={(event) => setSpaceForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
                <label htmlFor="space-parent">Parent</label>
                <select
                  id="space-parent"
                  value={spaceForm.parentId || selectedRootId}
                  onChange={(event) => setSpaceForm((prev) => ({ ...prev, parentId: event.target.value }))}
                >
                  {spaceOptions.map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.label}
                    </option>
                  ))}
                </select>
                <label htmlFor="space-notes">Notatki</label>
                <input
                  id="space-notes"
                  value={spaceForm.notes}
                  onChange={(event) => setSpaceForm((prev) => ({ ...prev, notes: event.target.value }))}
                />
                <button type="submit">Dodaj przestrzeń</button>
              </form>
            ) : null}
          </>
        ) : null}
      </section>
    );
  };

  const renderVlanListPage = () => (
    <section className="subpanel page-panel">
      <h3>VLAN - przegląd</h3>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nazwa</th>
              <th>Maska</th>
              <th>Range start</th>
              <th>Range end</th>
              <th>Notatki</th>
              <th>Akcje</th>
            </tr>
          </thead>
          <tbody>
            {vlanList.length === 0 ? (
              <tr>
                <td colSpan={7}>Brak VLAN</td>
              </tr>
            ) : (
              vlanList.map((vlan) => {
                const isEditing = isAdmin && editingVlanId === vlan.id;
                return (
                  <React.Fragment key={vlan.id}>
                    <tr>
                      <td>{vlan.vlan_id}</td>
                      <td>{vlan.name}</td>
                      <td>{vlan.subnet_mask}</td>
                      <td>{vlan.ip_range_start}</td>
                      <td>{vlan.ip_range_end}</td>
                      <td>{vlan.notes || "-"}</td>
                      <td>
                        {isAdmin ? (
                          <div className="table-actions">
                            <button type="button" className="button-secondary" onClick={() => onStartEditVlan(vlan)}>
                              {isEditing ? "Edytujesz" : "Edytuj"}
                            </button>
                            <button type="button" className="button-danger" onClick={() => onDeleteVlan(vlan.id)}>
                              Usuń
                            </button>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                    {isEditing ? (
                      <tr className="edit-row">
                        <td colSpan={7}>
                          <form
                            className="inline-form compact-form"
                            onSubmit={(event) => {
                              event.preventDefault();
                              onSaveVlan(vlan.id);
                            }}
                          >
                            <h4>Edycja VLAN</h4>
                            <div className="edit-grid">
                              <div>
                                <label htmlFor={`vlan-edit-id-${vlan.id}`}>VLAN ID</label>
                                <input
                                  id={`vlan-edit-id-${vlan.id}`}
                                  inputMode="numeric"
                                  value={vlanEditForm.vlanId}
                                  onChange={(event) =>
                                    setVlanEditForm((prev) => ({ ...prev, vlanId: event.target.value }))
                                  }
                                  required
                                />
                              </div>
                              <div>
                                <label htmlFor={`vlan-edit-name-${vlan.id}`}>Nazwa</label>
                                <input
                                  id={`vlan-edit-name-${vlan.id}`}
                                  value={vlanEditForm.name}
                                  onChange={(event) => setVlanEditForm((prev) => ({ ...prev, name: event.target.value }))}
                                  required
                                />
                              </div>
                              <div>
                                <label htmlFor={`vlan-edit-mask-${vlan.id}`}>Maska</label>
                                <input
                                  id={`vlan-edit-mask-${vlan.id}`}
                                  value={vlanEditForm.subnetMask}
                                  onChange={(event) =>
                                    setVlanEditForm((prev) => ({ ...prev, subnetMask: event.target.value }))
                                  }
                                  required
                                />
                              </div>
                              <div>
                                <label htmlFor={`vlan-edit-range-start-${vlan.id}`}>Zakres IP start</label>
                                <input
                                  id={`vlan-edit-range-start-${vlan.id}`}
                                  value={vlanEditForm.ipRangeStart}
                                  onChange={(event) =>
                                    setVlanEditForm((prev) => ({ ...prev, ipRangeStart: event.target.value }))
                                  }
                                  required
                                />
                              </div>
                              <div>
                                <label htmlFor={`vlan-edit-range-end-${vlan.id}`}>Zakres IP end</label>
                                <input
                                  id={`vlan-edit-range-end-${vlan.id}`}
                                  value={vlanEditForm.ipRangeEnd}
                                  onChange={(event) =>
                                    setVlanEditForm((prev) => ({ ...prev, ipRangeEnd: event.target.value }))
                                  }
                                  required
                                />
                              </div>
                              <div>
                                <label htmlFor={`vlan-edit-notes-${vlan.id}`}>Notatki</label>
                                <input
                                  id={`vlan-edit-notes-${vlan.id}`}
                                  value={vlanEditForm.notes}
                                  onChange={(event) =>
                                    setVlanEditForm((prev) => ({ ...prev, notes: event.target.value }))
                                  }
                                />
                              </div>
                            </div>
                            <div className="table-actions">
                              <button type="submit">Zapisz</button>
                              <button type="button" className="button-secondary" onClick={() => setEditingVlanId("")}>
                                Anuluj
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderVlanAddPage = () => (
    <section className="subpanel page-panel">
      <h3>VLAN - dodawanie</h3>
      {!isAdmin ? <p>Brak uprawnień (ADMIN)</p> : null}
      {isAdmin ? (
        <form className="inline-form" onSubmit={onCreateVlan}>
          <label htmlFor="vlan-id">VLAN ID</label>
          <input
            id="vlan-id"
            inputMode="numeric"
            value={vlanForm.vlanId}
            onChange={(event) => setVlanForm((prev) => ({ ...prev, vlanId: event.target.value }))}
            required
          />

          <label htmlFor="vlan-name">Nazwa</label>
          <input
            id="vlan-name"
            value={vlanForm.name}
            onChange={(event) => setVlanForm((prev) => ({ ...prev, name: event.target.value }))}
            required
          />

          <label htmlFor="vlan-mask">Maska</label>
          <input
            id="vlan-mask"
            value={vlanForm.subnetMask}
            onChange={(event) => setVlanForm((prev) => ({ ...prev, subnetMask: event.target.value }))}
            required
          />

          <label htmlFor="vlan-range-start">Zakres IP start</label>
          <input
            id="vlan-range-start"
            value={vlanForm.ipRangeStart}
            onChange={(event) => setVlanForm((prev) => ({ ...prev, ipRangeStart: event.target.value }))}
            required
          />

          <label htmlFor="vlan-range-end">Zakres IP end</label>
          <input
            id="vlan-range-end"
            value={vlanForm.ipRangeEnd}
            onChange={(event) => setVlanForm((prev) => ({ ...prev, ipRangeEnd: event.target.value }))}
            required
          />

          <label htmlFor="vlan-notes">Notatki</label>
          <input
            id="vlan-notes"
            value={vlanForm.notes}
            onChange={(event) => setVlanForm((prev) => ({ ...prev, notes: event.target.value }))}
          />

          <button type="submit">Zapisz VLAN</button>
        </form>
      ) : null}
    </section>
  );

  const renderWifiListPage = () => (
    <section className="subpanel page-panel">
      <h3>Wi-Fi - przegląd</h3>
      <div className="field">
        <label htmlFor="wifi-space-filter">Filtruj po przestrzeni</label>
        <select
          id="wifi-space-filter"
          value={wifiSpaceFilter}
          onChange={(event) => setWifiSpaceFilter(event.target.value)}
        >
          <option value="all">Wszystkie</option>
          {spaceOptions.map((space) => (
            <option key={space.id} value={space.id}>
              {space.label}
            </option>
          ))}
        </select>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>SSID</th>
              <th>Security</th>
              <th>Przestrzeń</th>
              <th>VLAN</th>
              <th>Hasło</th>
              <th>Notatki</th>
              <th>Akcje</th>
            </tr>
          </thead>
          <tbody>
            {filteredWifi.length === 0 ? (
              <tr>
                <td colSpan={7}>Brak Wi-Fi</td>
              </tr>
            ) : (
              filteredWifi.map((wifi) => {
                const space = spaces.find((item) => item.id === wifi.space_id);
                const vlan = vlanList.find((item) => item.id === wifi.vlan_id);
                const isEditing = isAdmin && editingWifiId === wifi.id;
                return (
                  <React.Fragment key={wifi.id}>
                    <tr>
                      <td>{wifi.ssid}</td>
                      <td>{wifi.security}</td>
                      <td>{space?.name || wifi.space_id}</td>
                      <td>{vlan ? `VLAN ${vlan.vlan_id}` : wifi.vlan_id}</td>
                      <td className="mono-cell">{revealedWifiPasswords[wifi.id] || "••••••••••••"}</td>
                      <td>{wifi.notes || "-"}</td>
                      <td>
                        <div className="table-actions">
                          <button type="button" onClick={() => onRevealWifi(wifi.id)}>
                            Pokaż
                          </button>
                          {isAdmin ? (
                            <>
                              <button
                                type="button"
                                className="button-secondary"
                                onClick={() => onStartEditWifi(wifi)}
                              >
                                {isEditing ? "Edytujesz" : "Edytuj"}
                              </button>
                              <button type="button" className="button-danger" onClick={() => onDeleteWifi(wifi.id)}>
                                Usuń
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {isEditing ? (
                      <tr className="edit-row">
                        <td colSpan={7}>
                          <form
                            className="inline-form compact-form"
                            onSubmit={(event) => {
                              event.preventDefault();
                              onSaveWifi(wifi.id);
                            }}
                          >
                            <h4>Edycja Wi-Fi</h4>
                            <div className="edit-grid">
                              <div>
                                <label htmlFor={`wifi-edit-ssid-${wifi.id}`}>SSID</label>
                                <input
                                  id={`wifi-edit-ssid-${wifi.id}`}
                                  value={wifiEditForm.ssid}
                                  onChange={(event) => setWifiEditForm((prev) => ({ ...prev, ssid: event.target.value }))}
                                  required
                                />
                              </div>
                              <div>
                                <label htmlFor={`wifi-edit-password-${wifi.id}`}>Nowe hasło (opcjonalnie)</label>
                                <input
                                  id={`wifi-edit-password-${wifi.id}`}
                                  type="password"
                                  value={wifiEditForm.password}
                                  onChange={(event) =>
                                    setWifiEditForm((prev) => ({ ...prev, password: event.target.value }))
                                  }
                                  placeholder="Zostaw puste, aby nie zmieniać"
                                />
                              </div>
                              <div>
                                <label htmlFor={`wifi-edit-security-${wifi.id}`}>Security</label>
                                <input
                                  id={`wifi-edit-security-${wifi.id}`}
                                  value={wifiEditForm.security}
                                  onChange={(event) =>
                                    setWifiEditForm((prev) => ({ ...prev, security: event.target.value }))
                                  }
                                  required
                                />
                              </div>
                              <div>
                                <label htmlFor={`wifi-edit-space-${wifi.id}`}>Przestrzeń</label>
                                <select
                                  id={`wifi-edit-space-${wifi.id}`}
                                  value={wifiEditForm.spaceId}
                                  onChange={(event) =>
                                    setWifiEditForm((prev) => ({ ...prev, spaceId: event.target.value }))
                                  }
                                  required
                                >
                                  <option value="">Wybierz</option>
                                  {spaceOptions.map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label htmlFor={`wifi-edit-vlan-${wifi.id}`}>VLAN</label>
                                <select
                                  id={`wifi-edit-vlan-${wifi.id}`}
                                  value={wifiEditForm.vlanId}
                                  onChange={(event) => setWifiEditForm((prev) => ({ ...prev, vlanId: event.target.value }))}
                                  required
                                >
                                  <option value="">Wybierz VLAN</option>
                                  {vlanList.map((option) => (
                                    <option key={option.id} value={option.id}>
                                      VLAN {option.vlan_id} - {option.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label htmlFor={`wifi-edit-notes-${wifi.id}`}>Notatki</label>
                                <input
                                  id={`wifi-edit-notes-${wifi.id}`}
                                  value={wifiEditForm.notes}
                                  onChange={(event) => setWifiEditForm((prev) => ({ ...prev, notes: event.target.value }))}
                                />
                              </div>
                            </div>
                            <div className="table-actions">
                              <button type="submit">Zapisz</button>
                              <button type="button" className="button-secondary" onClick={() => setEditingWifiId("")}>
                                Anuluj
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderWifiAddPage = () => (
    <section className="subpanel page-panel">
      <h3>Wi-Fi - dodawanie</h3>
      {!isAdmin ? <p>Brak uprawnień (ADMIN)</p> : null}
      {isAdmin ? (
        <form className="inline-form" onSubmit={onCreateWifi}>
          <label htmlFor="wifi-ssid">SSID</label>
          <input
            id="wifi-ssid"
            value={wifiForm.ssid}
            onChange={(event) => setWifiForm((prev) => ({ ...prev, ssid: event.target.value }))}
            required
          />

          <label htmlFor="wifi-password">Hasło</label>
          <input
            id="wifi-password"
            type="password"
            value={wifiForm.password}
            onChange={(event) => setWifiForm((prev) => ({ ...prev, password: event.target.value }))}
            required
          />

          <label htmlFor="wifi-security">Security</label>
          <input
            id="wifi-security"
            value={wifiForm.security}
            onChange={(event) => setWifiForm((prev) => ({ ...prev, security: event.target.value }))}
            required
          />

          <label htmlFor="wifi-space">Przestrzeń</label>
          <select
            id="wifi-space"
            value={wifiForm.spaceId}
            onChange={(event) => setWifiForm((prev) => ({ ...prev, spaceId: event.target.value }))}
            required
          >
            <option value="">Wybierz</option>
            {spaceOptions.map((space) => (
              <option key={space.id} value={space.id}>
                {space.label}
              </option>
            ))}
          </select>

          <label htmlFor="wifi-vlan">VLAN</label>
          <select
            id="wifi-vlan"
            value={wifiForm.vlanId}
            onChange={(event) => setWifiForm((prev) => ({ ...prev, vlanId: event.target.value }))}
            required
          >
            <option value="">Wybierz VLAN</option>
            {vlanList.map((vlan) => (
              <option key={vlan.id} value={vlan.id}>
                VLAN {vlan.vlan_id} - {vlan.name}
              </option>
            ))}
          </select>

          <label htmlFor="wifi-notes">Notatki</label>
          <input
            id="wifi-notes"
            value={wifiForm.notes}
            onChange={(event) => setWifiForm((prev) => ({ ...prev, notes: event.target.value }))}
          />

          <button type="submit">Zapisz Wi-Fi</button>
        </form>
      ) : null}
    </section>
  );

  const renderDevicesListPage = () => (
    <section className="subpanel page-panel">
      <h3>Urządzenia - przegląd</h3>
      <div className="field">
        <label htmlFor="device-space-filter">Filtruj po przestrzeni</label>
        <select
          id="device-space-filter"
          value={deviceSpaceFilter}
          onChange={(event) => setDeviceSpaceFilter(event.target.value)}
        >
          <option value="all">Wszystkie</option>
          {spaceOptions.map((space) => (
            <option key={space.id} value={space.id}>
              {space.label}
            </option>
          ))}
        </select>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nazwa</th>
              <th>Typ</th>
              <th>Vendor</th>
              <th>Model</th>
              <th>Serial</th>
              <th>Przestrzeń</th>
              <th>Odbiornik</th>
              <th>Akcje</th>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.length === 0 ? (
              <tr>
                <td colSpan={8}>Brak urządzeń</td>
              </tr>
            ) : (
              filteredDevices.map((device) => {
                const space = spaces.find((item) => item.id === device.space_id);
                const capabilities = [];
                if (device.supports_wifi) capabilities.push("Wi-Fi");
                if (device.supports_ethernet) capabilities.push("Ethernet");
                if (device.supports_zigbee) capabilities.push("Zigbee");
                if (device.supports_matter_thread) capabilities.push("MatterThread");
                if (device.supports_bluetooth) capabilities.push("Bluetooth");
                if (device.supports_ble) capabilities.push("BLE");
                const isEditing = isAdmin && editingDeviceId === device.id;
                return (
                  <React.Fragment key={device.id}>
                    <tr>
                      <td>{device.name}</td>
                      <td>{device.type}</td>
                      <td>{device.vendor || "-"}</td>
                      <td>{device.model || "-"}</td>
                      <td>{device.serial || "-"}</td>
                      <td>{space?.name || device.space_id}</td>
                      <td>{device.is_receiver ? capabilities.join(", ") || "tak" : "nie"}</td>
                      <td>
                        {isAdmin ? (
                          <div className="table-actions">
                            <button type="button" className="button-secondary" onClick={() => onStartEditDevice(device)}>
                              {isEditing ? "Edytujesz" : "Edytuj"}
                            </button>
                            <button type="button" className="button-danger" onClick={() => onDeleteDevice(device.id)}>
                              Usuń
                            </button>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                    {isEditing ? (
                      <tr className="edit-row">
                        <td colSpan={8}>
                          <form
                            className="inline-form compact-form"
                            onSubmit={(event) => {
                              event.preventDefault();
                              onSaveDevice(device.id);
                            }}
                          >
                            <h4>Edycja urządzenia</h4>
                            <div className="edit-grid">
                              <div>
                                <label htmlFor={`device-edit-name-${device.id}`}>Nazwa</label>
                                <input
                                  id={`device-edit-name-${device.id}`}
                                  value={deviceEditForm.name}
                                  onChange={(event) =>
                                    setDeviceEditForm((prev) => ({ ...prev, name: event.target.value }))
                                  }
                                  required
                                />
                              </div>
                              <div>
                                <label htmlFor={`device-edit-type-${device.id}`}>Typ</label>
                                <input
                                  id={`device-edit-type-${device.id}`}
                                  value={deviceEditForm.type}
                                  onChange={(event) =>
                                    setDeviceEditForm((prev) => ({ ...prev, type: event.target.value }))
                                  }
                                  required
                                />
                              </div>
                              <div>
                                <label htmlFor={`device-edit-space-${device.id}`}>Przestrzeń</label>
                                <select
                                  id={`device-edit-space-${device.id}`}
                                  value={deviceEditForm.spaceId}
                                  onChange={(event) =>
                                    setDeviceEditForm((prev) => ({ ...prev, spaceId: event.target.value }))
                                  }
                                  required
                                >
                                  <option value="">Wybierz</option>
                                  {spaceOptions.map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label htmlFor={`device-edit-vendor-${device.id}`}>Vendor</label>
                                <input
                                  id={`device-edit-vendor-${device.id}`}
                                  value={deviceEditForm.vendor}
                                  onChange={(event) =>
                                    setDeviceEditForm((prev) => ({ ...prev, vendor: event.target.value }))
                                  }
                                />
                              </div>
                              <div>
                                <label htmlFor={`device-edit-model-${device.id}`}>Model</label>
                                <input
                                  id={`device-edit-model-${device.id}`}
                                  value={deviceEditForm.model}
                                  onChange={(event) =>
                                    setDeviceEditForm((prev) => ({ ...prev, model: event.target.value }))
                                  }
                                />
                              </div>
                              <div>
                                <label htmlFor={`device-edit-serial-${device.id}`}>Serial</label>
                                <input
                                  id={`device-edit-serial-${device.id}`}
                                  value={deviceEditForm.serial}
                                  onChange={(event) =>
                                    setDeviceEditForm((prev) => ({ ...prev, serial: event.target.value }))
                                  }
                                />
                              </div>
                              <div className="span-2">
                                <label htmlFor={`device-edit-notes-${device.id}`}>Notatki</label>
                                <input
                                  id={`device-edit-notes-${device.id}`}
                                  value={deviceEditForm.notes}
                                  onChange={(event) =>
                                    setDeviceEditForm((prev) => ({ ...prev, notes: event.target.value }))
                                  }
                                />
                              </div>
                            </div>

                            <label htmlFor={`device-edit-receiver-${device.id}`} className="checkbox-row">
                              <input
                                id={`device-edit-receiver-${device.id}`}
                                type="checkbox"
                                checked={deviceEditForm.isReceiver}
                                onChange={(event) =>
                                  setDeviceEditForm((prev) => ({
                                    ...prev,
                                    isReceiver: event.target.checked,
                                    supportsWifi: event.target.checked ? prev.supportsWifi : false,
                                    supportsEthernet: event.target.checked ? prev.supportsEthernet : false,
                                    supportsZigbee: event.target.checked ? prev.supportsZigbee : false,
                                    supportsMatterThread: event.target.checked ? prev.supportsMatterThread : false,
                                    supportsBluetooth: event.target.checked ? prev.supportsBluetooth : false,
                                    supportsBle: event.target.checked ? prev.supportsBle : false,
                                  }))
                                }
                              />
                              Odbiornik / koordynator
                            </label>

                            <div className="checkbox-grid">
                              <label className="checkbox-row">
                                <input
                                  type="checkbox"
                                  checked={deviceEditForm.supportsWifi}
                                  disabled={!deviceEditForm.isReceiver}
                                  onChange={(event) =>
                                    setDeviceEditForm((prev) => ({ ...prev, supportsWifi: event.target.checked }))
                                  }
                                />
                                Wi-Fi
                              </label>
                              <label className="checkbox-row">
                                <input
                                  type="checkbox"
                                  checked={deviceEditForm.supportsEthernet}
                                  disabled={!deviceEditForm.isReceiver}
                                  onChange={(event) =>
                                    setDeviceEditForm((prev) => ({ ...prev, supportsEthernet: event.target.checked }))
                                  }
                                />
                                Ethernet
                              </label>
                              <label className="checkbox-row">
                                <input
                                  type="checkbox"
                                  checked={deviceEditForm.supportsZigbee}
                                  disabled={!deviceEditForm.isReceiver}
                                  onChange={(event) =>
                                    setDeviceEditForm((prev) => ({ ...prev, supportsZigbee: event.target.checked }))
                                  }
                                />
                                Zigbee
                              </label>
                              <label className="checkbox-row">
                                <input
                                  type="checkbox"
                                  checked={deviceEditForm.supportsMatterThread}
                                  disabled={!deviceEditForm.isReceiver}
                                  onChange={(event) =>
                                    setDeviceEditForm((prev) => ({
                                      ...prev,
                                      supportsMatterThread: event.target.checked,
                                    }))
                                  }
                                />
                                Matter Thread
                              </label>
                              <label className="checkbox-row">
                                <input
                                  type="checkbox"
                                  checked={deviceEditForm.supportsBluetooth}
                                  disabled={!deviceEditForm.isReceiver}
                                  onChange={(event) =>
                                    setDeviceEditForm((prev) => ({ ...prev, supportsBluetooth: event.target.checked }))
                                  }
                                />
                                Bluetooth
                              </label>
                              <label className="checkbox-row">
                                <input
                                  type="checkbox"
                                  checked={deviceEditForm.supportsBle}
                                  disabled={!deviceEditForm.isReceiver}
                                  onChange={(event) =>
                                    setDeviceEditForm((prev) => ({ ...prev, supportsBle: event.target.checked }))
                                  }
                                />
                                BLE
                              </label>
                            </div>

                            <div className="table-actions">
                              <button type="submit">Zapisz</button>
                              <button type="button" className="button-secondary" onClick={() => setEditingDeviceId("")}>
                                Anuluj
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderDeviceAddPage = () => (
    <section className="subpanel page-panel">
      <h3>Urządzenia - dodawanie</h3>
      {!isAdmin ? <p>Brak uprawnień (ADMIN)</p> : null}
      {isAdmin ? (
        <form className="inline-form" onSubmit={onCreateDevice}>
          <label htmlFor="device-name">Nazwa</label>
          <input
            id="device-name"
            value={deviceForm.name}
            onChange={(event) => setDeviceForm((prev) => ({ ...prev, name: event.target.value }))}
            required
          />

          <label htmlFor="device-type">Typ</label>
          <input
            id="device-type"
            value={deviceForm.type}
            onChange={(event) => setDeviceForm((prev) => ({ ...prev, type: event.target.value }))}
            required
          />

          <label htmlFor="device-space">Przestrzeń</label>
          <select
            id="device-space"
            value={deviceForm.spaceId}
            onChange={(event) => setDeviceForm((prev) => ({ ...prev, spaceId: event.target.value }))}
            required
          >
            <option value="">Wybierz</option>
            {spaceOptions.map((space) => (
              <option key={space.id} value={space.id}>
                {space.label}
              </option>
            ))}
          </select>

          <label htmlFor="device-vendor">Vendor</label>
          <input
            id="device-vendor"
            value={deviceForm.vendor}
            onChange={(event) => setDeviceForm((prev) => ({ ...prev, vendor: event.target.value }))}
          />

          <label htmlFor="device-model">Model</label>
          <input
            id="device-model"
            value={deviceForm.model}
            onChange={(event) => setDeviceForm((prev) => ({ ...prev, model: event.target.value }))}
          />

          <label htmlFor="device-serial">Serial</label>
          <input
            id="device-serial"
            value={deviceForm.serial}
            onChange={(event) => setDeviceForm((prev) => ({ ...prev, serial: event.target.value }))}
          />

          <label htmlFor="device-notes">Notatki</label>
          <input
            id="device-notes"
            value={deviceForm.notes}
            onChange={(event) => setDeviceForm((prev) => ({ ...prev, notes: event.target.value }))}
          />

          <label htmlFor="is-receiver" className="checkbox-row">
            <input
              id="is-receiver"
              type="checkbox"
              checked={deviceForm.isReceiver}
              onChange={(event) =>
                setDeviceForm((prev) => ({
                  ...prev,
                  isReceiver: event.target.checked,
                  supportsWifi: event.target.checked ? prev.supportsWifi : false,
                  supportsEthernet: event.target.checked ? prev.supportsEthernet : false,
                  supportsZigbee: event.target.checked ? prev.supportsZigbee : false,
                  supportsMatterThread: event.target.checked ? prev.supportsMatterThread : false,
                  supportsBluetooth: event.target.checked ? prev.supportsBluetooth : false,
                  supportsBle: event.target.checked ? prev.supportsBle : false,
                }))
              }
            />
            Odbiornik / koordynator
          </label>

          <div className="checkbox-grid">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={deviceForm.supportsWifi}
                disabled={!deviceForm.isReceiver}
                onChange={(event) => setDeviceForm((prev) => ({ ...prev, supportsWifi: event.target.checked }))}
              />
              Wi-Fi
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={deviceForm.supportsEthernet}
                disabled={!deviceForm.isReceiver}
                onChange={(event) => setDeviceForm((prev) => ({ ...prev, supportsEthernet: event.target.checked }))}
              />
              Ethernet
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={deviceForm.supportsZigbee}
                disabled={!deviceForm.isReceiver}
                onChange={(event) => setDeviceForm((prev) => ({ ...prev, supportsZigbee: event.target.checked }))}
              />
              Zigbee
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={deviceForm.supportsMatterThread}
                disabled={!deviceForm.isReceiver}
                onChange={(event) => setDeviceForm((prev) => ({ ...prev, supportsMatterThread: event.target.checked }))}
              />
              Matter Thread
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={deviceForm.supportsBluetooth}
                disabled={!deviceForm.isReceiver}
                onChange={(event) => setDeviceForm((prev) => ({ ...prev, supportsBluetooth: event.target.checked }))}
              />
              Bluetooth
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={deviceForm.supportsBle}
                disabled={!deviceForm.isReceiver}
                onChange={(event) => setDeviceForm((prev) => ({ ...prev, supportsBle: event.target.checked }))}
              />
              BLE
            </label>
          </div>

          <button type="submit">Zapisz urządzenie</button>
        </form>
      ) : null}
    </section>
  );

  const renderUsersListPage = () => (
    <section className="subpanel page-panel">
      <h3>Użytkownicy - przegląd i przypisania rootów</h3>
      {!isAdmin ? <p>Brak uprawnień (ADMIN)</p> : null}
      {isAdmin ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Rola</th>
                <th>Aktywny</th>
                <th>Rooty</th>
                <th>Hasło</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6}>Brak użytkowników</td>
                </tr>
              ) : (
                users.map((user) => {
                  const draft = userDrafts[user.id] || {
                    email: user.email,
                    role: user.role,
                    is_active: user.is_active,
                    root_ids: user.root_ids || [],
                  };
                  return (
                    <tr key={user.id}>
                      <td>
                        <input
                          value={draft.email || ""}
                          onChange={(event) =>
                            setUserDrafts((prev) => ({
                              ...prev,
                              [user.id]: { ...draft, email: event.target.value },
                            }))
                          }
                        />
                      </td>
                      <td>
                        <select
                          value={draft.role || "USER"}
                          onChange={(event) =>
                            setUserDrafts((prev) => ({
                              ...prev,
                              [user.id]: { ...draft, role: event.target.value },
                            }))
                          }
                        >
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </td>
                      <td>
                        <label className="checkbox-row compact">
                          <input
                            type="checkbox"
                            checked={Boolean(draft.is_active)}
                            onChange={(event) =>
                              setUserDrafts((prev) => ({
                                ...prev,
                                [user.id]: { ...draft, is_active: event.target.checked },
                              }))
                            }
                          />
                          tak
                        </label>
                      </td>
                      <td>
                        <div className="checklist">
                          {roots.map((root) => (
                            <label key={`${user.id}-${root.id}`} className="checkbox-row compact">
                              <input
                                type="checkbox"
                                checked={(draft.root_ids || []).includes(root.id)}
                                onChange={(event) => {
                                  const next = new Set(draft.root_ids || []);
                                  if (event.target.checked) {
                                    next.add(root.id);
                                  } else {
                                    next.delete(root.id);
                                  }
                                  setUserDrafts((prev) => ({
                                    ...prev,
                                    [user.id]: { ...draft, root_ids: Array.from(next) },
                                  }));
                                }}
                              />
                              {root.name}
                            </label>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className="password-cell">
                          <input
                            type="password"
                            value={passwordDrafts[user.id] || ""}
                            onChange={(event) =>
                              setPasswordDrafts((prev) => ({
                                ...prev,
                                [user.id]: event.target.value,
                              }))
                            }
                            placeholder="Nowe hasło"
                          />
                          <button type="button" className="button-secondary" onClick={() => onSetUserPassword(user.id)}>
                            Ustaw hasło
                          </button>
                        </div>
                      </td>
                      <td>
                        <button type="button" onClick={() => onSaveUser(user.id)}>
                          Zapisz
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );

  const renderUserAddPage = () => (
    <section className="subpanel page-panel">
      <h3>Użytkownicy - dodawanie</h3>
      {!isAdmin ? <p>Brak uprawnień (ADMIN)</p> : null}
      {isAdmin ? (
        <form className="inline-form" onSubmit={onCreateUser}>
          <label htmlFor="new-user-email">Email</label>
          <input
            id="new-user-email"
            type="email"
            value={userForm.email}
            onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))}
            required
          />

          <label htmlFor="new-user-password">Hasło</label>
          <input
            id="new-user-password"
            type="password"
            value={userForm.password}
            onChange={(event) => setUserForm((prev) => ({ ...prev, password: event.target.value }))}
            required
          />

          <label htmlFor="new-user-role">Rola</label>
          <select
            id="new-user-role"
            value={userForm.role}
            onChange={(event) => setUserForm((prev) => ({ ...prev, role: event.target.value }))}
          >
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={userForm.isActive}
              onChange={(event) => setUserForm((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
            Konto aktywne
          </label>

          <div>
            <strong>Przypisane rooty</strong>
            <div className="checklist">
              {roots.map((root) => (
                <label key={`new-user-root-${root.id}`} className="checkbox-row compact">
                  <input
                    type="checkbox"
                    checked={userForm.rootIds.includes(root.id)}
                    onChange={(event) => {
                      const next = new Set(userForm.rootIds);
                      if (event.target.checked) {
                        next.add(root.id);
                      } else {
                        next.delete(root.id);
                      }
                      setUserForm((prev) => ({ ...prev, rootIds: Array.from(next) }));
                    }}
                  />
                  {root.name}
                </label>
              ))}
            </div>
          </div>

          <button type="submit">Utwórz użytkownika</button>
        </form>
      ) : null}
    </section>
  );

  const renderTopologyPage = () => (
    <section className="subpanel page-panel">
      <h3>Topologia - generowanie PNG</h3>
      <p className="muted">Graf interaktywny został zastąpiony statycznym PNG generowanym na żądanie.</p>
      <button type="button" onClick={onGenerateTopology} disabled={!selectedRootId || topologyLoading}>
        {topologyLoading ? "Generowanie..." : "Generuj PNG"}
      </button>
      {topologyUrl ? (
        <div className="topology-preview">
          <img src={topologyUrl} alt="Topology PNG" />
          <a href={topologyUrl} download={`topology-${selectedRootId}.png`}>
            Pobierz PNG
          </a>
        </div>
      ) : null}
    </section>
  );

  const renderPage = () => {
    switch (activePage) {
      case "roots":
        return renderRootsPage();
      case "network-vlan-list":
        return renderVlanListPage();
      case "network-vlan-add":
        return renderVlanAddPage();
      case "network-wifi-list":
        return renderWifiListPage();
      case "network-wifi-add":
        return renderWifiAddPage();
      case "devices-list":
        return renderDevicesListPage();
      case "devices-add":
        return renderDeviceAddPage();
      case "users-list":
        return renderUsersListPage();
      case "users-add":
        return renderUserAddPage();
      case "topology":
        return renderTopologyPage();
      default:
        return renderRootsPage();
    }
  };

  return (
    <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Hardware Registry</h2>
            <p className="muted">
              {me.email} ({me.role})
            </p>
          </div>
          <button type="button" className="button-secondary" onClick={onLogout}>
            Wyloguj
          </button>
        </div>

        <div className="field">
          <label htmlFor="root-selector">Aktywny root</label>
          <select id="root-selector" value={selectedRootId} onChange={onRootChange}>
            {roots.map((root) => (
              <option key={root.id} value={root.id}>
                {root.name}
              </option>
            ))}
          </select>
        </div>

        <div className="console-layout">
          <aside className="menu-panel">
            <h3>Menu</h3>

            <p className="menu-group-title">Rooty</p>
            <MenuButton active={activePage === "roots"} onClick={() => setActivePage("roots")}>Rooty i przestrzenie</MenuButton>

            <p className="menu-group-title">Sieciowe</p>
            <MenuButton
              active={activePage === "network-vlan-list"}
              onClick={() => setActivePage("network-vlan-list")}
            >
              VLAN - przegląd
            </MenuButton>
            <MenuButton
              active={activePage === "network-vlan-add"}
              onClick={() => setActivePage("network-vlan-add")}
            >
              VLAN - dodawanie
            </MenuButton>
            <MenuButton
              active={activePage === "network-wifi-list"}
              onClick={() => setActivePage("network-wifi-list")}
            >
              Wi-Fi - przegląd
            </MenuButton>
            <MenuButton
              active={activePage === "network-wifi-add"}
              onClick={() => setActivePage("network-wifi-add")}
            >
              Wi-Fi - dodawanie
            </MenuButton>

            <p className="menu-group-title">Urządzenia</p>
            <MenuButton active={activePage === "devices-list"} onClick={() => setActivePage("devices-list")}>Urządzenia - przegląd</MenuButton>
            <MenuButton active={activePage === "devices-add"} onClick={() => setActivePage("devices-add")}>Urządzenia - dodawanie</MenuButton>

            <p className="menu-group-title">Topologia</p>
            <MenuButton active={activePage === "topology"} onClick={() => setActivePage("topology")}>Topologia PNG</MenuButton>

            {isAdmin ? (
              <>
                <p className="menu-group-title">Użytkownicy</p>
                <MenuButton active={activePage === "users-list"} onClick={() => setActivePage("users-list")}>Użytkownicy - przegląd</MenuButton>
                <MenuButton active={activePage === "users-add"} onClick={() => setActivePage("users-add")}>Użytkownicy - dodawanie</MenuButton>
              </>
            ) : null}
          </aside>

          <div className="content-panel">{renderPage()}</div>
        </div>

        {loading ? <p>Ładowanie danych...</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>
  );
}

function App() {
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState([]);
  const toastTimersRef = useRef(new Map());

  const notify = useCallback((message, type = "success") => {
    if (!message) {
      return;
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    const timerId = setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
      toastTimersRef.current.delete(id);
    }, 3200);
    toastTimersRef.current.set(id, timerId);
  }, []);

  const fetchMe = async () => {
    const accessToken = localStorage.getItem(ACCESS_KEY);
    if (!accessToken) {
      setMe(null);
      return;
    }

    const { response, payload } = await request("/auth/me", {
      headers: authHeaders(accessToken),
    });

    if (!response.ok) {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
      setMe(null);
      notify("Sesja wygasła. Zaloguj się ponownie.", "info");
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
      const message = err.message || "Nie można pobrać statusu setup";
      setError(message);
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    setMe(null);
    notify("Wylogowano", "info");
  };

  useEffect(() => {
    loadStatus();
    return () => {
      for (const timerId of toastTimersRef.current.values()) {
        clearTimeout(timerId);
      }
      toastTimersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="app">
      <header className="app-header">
        <h1>Hardware Registry</h1>
        <p className="muted">API URL: {apiBase}</p>
      </header>

      {loading ? <p>Sprawdzanie statusu...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && !error && needsSetup ? <SetupAdminScreen onSetupDone={loadStatus} notify={notify} /> : null}
      {!loading && !error && !needsSetup && !me ? <LoginScreen onLoggedIn={fetchMe} notify={notify} /> : null}
      {!loading && !error && !needsSetup && me && me.must_change_password ? (
        <ChangePasswordScreen me={me} onChanged={fetchMe} notify={notify} />
      ) : null}
      {!loading && !error && !needsSetup && me && !me.must_change_password ? (
        <ExplorerScreen
          me={me}
          accessToken={localStorage.getItem(ACCESS_KEY)}
          onLogout={handleLogout}
          notify={notify}
        />
      ) : null}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>
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
