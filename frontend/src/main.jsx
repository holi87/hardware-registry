import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import cytoscape from "cytoscape";
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
  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [devicesError, setDevicesError] = useState("");
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [deviceDetail, setDeviceDetail] = useState(null);
  const [deviceDetailLoading, setDeviceDetailLoading] = useState(false);
  const [deviceDetailError, setDeviceDetailError] = useState("");
  const [showDeviceWizard, setShowDeviceWizard] = useState(false);
  const [deviceWizardStep, setDeviceWizardStep] = useState(1);
  const [deviceSubmitting, setDeviceSubmitting] = useState(false);
  const [newDevice, setNewDevice] = useState({
    name: "",
    type: "",
    vendor: "",
    model: "",
    serial: "",
    notes: "",
  });
  const [interfaceSubmitting, setInterfaceSubmitting] = useState(false);
  const [newInterface, setNewInterface] = useState({ name: "", type: "", mac: "", notes: "" });
  const [connections, setConnections] = useState([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionsError, setConnectionsError] = useState("");
  const [rootDevices, setRootDevices] = useState([]);
  const [deviceInterfacesMap, setDeviceInterfacesMap] = useState({});
  const [showConnectionWizard, setShowConnectionWizard] = useState(false);
  const [connectionSubmitting, setConnectionSubmitting] = useState(false);
  const [newConnection, setNewConnection] = useState({
    fromDeviceId: "",
    fromInterfaceId: "",
    toDeviceId: "",
    toInterfaceId: "",
    technology: "ETHERNET",
    vlanId: "",
    notes: "",
  });
  const [graphData, setGraphData] = useState({ devices: [], connections: [] });
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState("");
  const [graphTechnologyFilter, setGraphTechnologyFilter] = useState("all");
  const [graphSpaceFilter, setGraphSpaceFilter] = useState("all");
  const [graphTypeFilter, setGraphTypeFilter] = useState("all");
  const [graphSearch, setGraphSearch] = useState("");
  const graphContainerRef = useRef(null);
  const graphInstanceRef = useRef(null);

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

  const loadDevices = async (rootId, spaceId) => {
    if (!rootId || !spaceId) {
      setDevices([]);
      setSelectedDeviceId("");
      return;
    }

    setDevicesLoading(true);
    setDevicesError("");
    try {
      const { response, payload } = await request(`/devices?root_id=${rootId}&space_id=${spaceId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się pobrać urządzeń", payload));
      }
      const list = payload || [];
      setDevices(list);
      setSelectedDeviceId((prev) => (prev && list.some((item) => item.id === prev) ? prev : list[0]?.id || ""));
    } catch (err) {
      setDevices([]);
      setSelectedDeviceId("");
      setDevicesError(err.message || "Błąd pobierania urządzeń");
    } finally {
      setDevicesLoading(false);
    }
  };

  const loadDeviceDetail = async (deviceId) => {
    if (!deviceId) {
      setDeviceDetail(null);
      setDeviceDetailError("");
      return;
    }

    setDeviceDetailLoading(true);
    setDeviceDetailError("");
    try {
      const { response, payload } = await request(`/devices/${deviceId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się pobrać szczegółów urządzenia", payload));
      }
      setDeviceDetail(payload);
      setDeviceInterfacesMap((prev) => ({ ...prev, [deviceId]: payload.interfaces || [] }));
    } catch (err) {
      setDeviceDetail(null);
      setDeviceDetailError(err.message || "Błąd pobierania szczegółów");
    } finally {
      setDeviceDetailLoading(false);
    }
  };

  const loadRootDevices = async (rootId) => {
    if (!rootId) {
      setRootDevices([]);
      return;
    }
    try {
      const { response, payload } = await request(`/devices?root_id=${rootId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się pobrać urządzeń dla roota", payload));
      }
      setRootDevices(payload || []);
    } catch (_) {
      setRootDevices([]);
    }
  };

  const ensureDeviceInterfaces = async (deviceId) => {
    if (!deviceId || deviceInterfacesMap[deviceId]) {
      return;
    }
    try {
      const { response, payload } = await request(`/devices/${deviceId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        return;
      }
      setDeviceInterfacesMap((prev) => ({ ...prev, [deviceId]: payload.interfaces || [] }));
    } catch (_) {
      // ignore lazy loading errors in wizard
    }
  };

  const loadConnections = async (rootId, deviceId) => {
    if (!rootId || !deviceId) {
      setConnections([]);
      return;
    }
    setConnectionsLoading(true);
    setConnectionsError("");
    try {
      const { response, payload } = await request(`/connections?root_id=${rootId}&device_id=${deviceId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się pobrać połączeń", payload));
      }
      setConnections(payload || []);
    } catch (err) {
      setConnections([]);
      setConnectionsError(err.message || "Błąd pobierania połączeń");
    } finally {
      setConnectionsLoading(false);
    }
  };

  const loadGraph = async (rootId) => {
    if (!rootId) {
      setGraphData({ devices: [], connections: [] });
      return;
    }
    setGraphLoading(true);
    setGraphError("");
    try {
      const { response, payload } = await request(`/graph?root_id=${rootId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się pobrać grafu", payload));
      }
      setGraphData(payload || { devices: [], connections: [] });
    } catch (err) {
      setGraphData({ devices: [], connections: [] });
      setGraphError(err.message || "Błąd pobierania grafu");
    } finally {
      setGraphLoading(false);
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

  useEffect(() => {
    loadDevices(selectedRootId, currentLocationId);
    setShowDeviceWizard(false);
    setDeviceWizardStep(1);
    setShowConnectionWizard(false);
  }, [selectedRootId, currentLocationId, accessToken]);

  useEffect(() => {
    loadDeviceDetail(selectedDeviceId);
  }, [selectedDeviceId, accessToken]);

  useEffect(() => {
    setDeviceInterfacesMap({});
    loadRootDevices(selectedRootId);
    loadGraph(selectedRootId);
    setGraphTechnologyFilter("all");
    setGraphSpaceFilter("all");
    setGraphTypeFilter("all");
    setGraphSearch("");
    setNewConnection({
      fromDeviceId: "",
      fromInterfaceId: "",
      toDeviceId: "",
      toInterfaceId: "",
      technology: "ETHERNET",
      vlanId: "",
      notes: "",
    });
  }, [selectedRootId, accessToken]);

  useEffect(() => {
    loadConnections(selectedRootId, selectedDeviceId);
  }, [selectedRootId, selectedDeviceId, accessToken]);

  useEffect(() => {
    if (!newConnection.fromDeviceId) {
      return;
    }
    ensureDeviceInterfaces(newConnection.fromDeviceId);
  }, [newConnection.fromDeviceId, accessToken]);

  useEffect(() => {
    if (!newConnection.toDeviceId) {
      return;
    }
    ensureDeviceInterfaces(newConnection.toDeviceId);
  }, [newConnection.toDeviceId, accessToken]);

  useEffect(
    () => () => {
      if (graphInstanceRef.current) {
        graphInstanceRef.current.destroy();
        graphInstanceRef.current = null;
      }
    },
    [],
  );

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

  const fromInterfaces = deviceInterfacesMap[newConnection.fromDeviceId] || [];
  const toInterfaces = deviceInterfacesMap[newConnection.toDeviceId] || [];

  const deviceNameById = useMemo(() => {
    const map = new Map();
    for (const device of rootDevices) {
      map.set(device.id, device.name);
    }
    return map;
  }, [rootDevices]);

  const interfaceNameById = useMemo(() => {
    const map = new Map();
    Object.values(deviceInterfacesMap).forEach((interfaces) => {
      (interfaces || []).forEach((item) => map.set(item.id, item.name));
    });
    if (deviceDetail?.interfaces) {
      deviceDetail.interfaces.forEach((item) => map.set(item.id, item.name));
    }
    return map;
  }, [deviceInterfacesMap, deviceDetail]);

  const graphTechnologyOptions = useMemo(() => {
    const values = new Set(graphData.connections.map((edge) => edge.technology));
    return Array.from(values).sort();
  }, [graphData]);

  const graphTypeOptions = useMemo(() => {
    const values = new Set(graphData.devices.map((node) => node.type));
    return Array.from(values).sort((a, b) => a.localeCompare(b, "pl"));
  }, [graphData]);

  const filteredGraph = useMemo(() => {
    const devicesFiltered = graphData.devices.filter((node) => {
      if (graphSpaceFilter !== "all" && node.space_id !== graphSpaceFilter) {
        return false;
      }
      if (graphTypeFilter !== "all" && node.type !== graphTypeFilter) {
        return false;
      }
      return true;
    });

    const deviceIds = new Set(devicesFiltered.map((node) => node.id));
    const connectionsFiltered = graphData.connections.filter((edge) => {
      if (graphTechnologyFilter !== "all" && edge.technology !== graphTechnologyFilter) {
        return false;
      }
      return deviceIds.has(edge.from_device_id) && deviceIds.has(edge.to_device_id);
    });

    return { devices: devicesFiltered, connections: connectionsFiltered };
  }, [graphData, graphSpaceFilter, graphTechnologyFilter, graphTypeFilter]);

  const graphElements = useMemo(() => {
    const nodes = filteredGraph.devices.map((node) => ({
      data: {
        id: node.id,
        label: node.name,
        type: node.type,
        spaceId: node.space_id,
      },
    }));
    const edges = filteredGraph.connections.map((edge) => ({
      data: {
        id: edge.id,
        source: edge.from_device_id,
        target: edge.to_device_id,
        label: edge.technology,
      },
    }));
    return [...nodes, ...edges];
  }, [filteredGraph]);

  useEffect(() => {
    if (!graphContainerRef.current) {
      return;
    }

    if (graphInstanceRef.current) {
      graphInstanceRef.current.destroy();
      graphInstanceRef.current = null;
    }

    graphInstanceRef.current = cytoscape({
      container: graphContainerRef.current,
      elements: graphElements,
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "background-color": "#0f172a",
            color: "#f8fafc",
            "font-size": "11px",
            "text-valign": "center",
            "text-halign": "center",
            padding: "8px",
            shape: "roundrectangle",
            width: "label",
            height: "label",
          },
        },
        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": "#64748b",
            "target-arrow-color": "#64748b",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            label: "data(label)",
            "font-size": "9px",
            color: "#334155",
          },
        },
        {
          selector: ".highlighted",
          style: {
            "background-color": "#0ea5e9",
            "line-color": "#0ea5e9",
            "target-arrow-color": "#0ea5e9",
          },
        },
      ],
      layout: {
        name: "cose",
        fit: true,
        animate: false,
      },
    });
  }, [graphElements]);

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

  const onCreateDevice = async (event) => {
    event.preventDefault();
    if (!selectedRootId || !currentLocationId) {
      return;
    }

    setDeviceSubmitting(true);
    setDevicesError("");
    try {
      const { response, payload } = await request("/devices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          root_id: selectedRootId,
          space_id: currentLocationId,
          name: newDevice.name,
          type: newDevice.type,
          vendor: newDevice.vendor || null,
          model: newDevice.model || null,
          serial: newDevice.serial || null,
          notes: newDevice.notes || null,
        }),
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się dodać urządzenia", payload));
      }

      setShowDeviceWizard(false);
      setDeviceWizardStep(1);
      setNewDevice({ name: "", type: "", vendor: "", model: "", serial: "", notes: "" });
      await loadDevices(selectedRootId, currentLocationId);
      if (payload?.id) {
        setSelectedDeviceId(payload.id);
      }
      const treeData = await loadTree(selectedRootId);
      setTree(treeData);
    } catch (err) {
      setDevicesError(err.message || "Błąd dodawania urządzenia");
    } finally {
      setDeviceSubmitting(false);
    }
  };

  const onCreateInterface = async (event) => {
    event.preventDefault();
    if (!selectedDeviceId) {
      return;
    }

    setInterfaceSubmitting(true);
    setDeviceDetailError("");
    try {
      const { response, payload } = await request(`/devices/${selectedDeviceId}/interfaces`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: newInterface.name,
          type: newInterface.type,
          mac: newInterface.mac || null,
          notes: newInterface.notes || null,
        }),
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się dodać interfejsu", payload));
      }

      setNewInterface({ name: "", type: "", mac: "", notes: "" });
      await loadDeviceDetail(selectedDeviceId);
    } catch (err) {
      setDeviceDetailError(err.message || "Błąd dodawania interfejsu");
    } finally {
      setInterfaceSubmitting(false);
    }
  };

  const onCreateConnection = async (event) => {
    event.preventDefault();
    if (!selectedRootId) {
      return;
    }

    if (!newConnection.fromInterfaceId || !newConnection.toInterfaceId) {
      setConnectionsError("Wybierz oba interfejsy połączenia");
      return;
    }

    setConnectionSubmitting(true);
    setConnectionsError("");
    try {
      const payload = {
        root_id: selectedRootId,
        from_interface_id: newConnection.fromInterfaceId,
        to_interface_id: newConnection.toInterfaceId,
        technology: newConnection.technology,
        vlan_id: newConnection.technology === "ETHERNET" ? newConnection.vlanId || null : null,
        notes: newConnection.notes || null,
      };

      const { response, payload: responsePayload } = await request("/connections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(parseApiError("Nie udało się utworzyć połączenia", responsePayload));
      }

      setShowConnectionWizard(false);
      setNewConnection({
        fromDeviceId: "",
        fromInterfaceId: "",
        toDeviceId: "",
        toInterfaceId: "",
        technology: "ETHERNET",
        vlanId: "",
        notes: "",
      });
      await loadConnections(selectedRootId, selectedDeviceId);
    } catch (err) {
      setConnectionsError(err.message || "Błąd tworzenia połączenia");
    } finally {
      setConnectionSubmitting(false);
    }
  };

  const onGraphSearch = () => {
    const cy = graphInstanceRef.current;
    const term = graphSearch.trim().toLowerCase();
    if (!cy || !term) {
      return;
    }

    const matches = cy.nodes().filter((node) => node.data("label").toLowerCase().includes(term));
    if (matches.length === 0) {
      return;
    }

    const target = matches[0];
    cy.elements().removeClass("highlighted");
    target.addClass("highlighted");
    cy.animate({
      fit: {
        eles: target,
        padding: 80,
      },
      duration: 250,
    });
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

          <section className="subpanel">
            <div className="panel-header">
              <h3>Urządzenia w przestrzeni</h3>
              {isAdmin ? (
                <div className="wizard-actions">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => {
                      setShowConnectionWizard((prev) => !prev);
                    }}
                  >
                    {showConnectionWizard ? "Zamknij połączenia" : "Dodaj połączenie"}
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => {
                      setShowDeviceWizard((prev) => !prev);
                      setDeviceWizardStep(1);
                    }}
                  >
                    {showDeviceWizard ? "Zamknij kreator" : "Dodaj urządzenie"}
                  </button>
                </div>
              ) : null}
            </div>

            {devicesLoading ? <p>Ładowanie urządzeń...</p> : null}
            {devicesError ? <p className="error">{devicesError}</p> : null}
            {!devicesLoading && devices.length === 0 ? <p>Brak urządzeń w tej przestrzeni.</p> : null}
            {!devicesLoading && devices.length > 0 ? (
              <div className="device-list">
                {devices.map((device) => (
                  <button
                    key={device.id}
                    type="button"
                    className={`device-item ${selectedDeviceId === device.id ? "is-active" : ""}`}
                    onClick={() => setSelectedDeviceId(device.id)}
                  >
                    <strong>{device.name}</strong>
                    <span className="muted">{device.type}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {isAdmin && showDeviceWizard ? (
              <form className="inline-form" onSubmit={onCreateDevice}>
                <h4>Wizard: nowe urządzenie</h4>
                {deviceWizardStep === 1 ? (
                  <>
                    <label htmlFor="device-name">Nazwa urządzenia</label>
                    <input
                      id="device-name"
                      value={newDevice.name}
                      onChange={(event) => setNewDevice((prev) => ({ ...prev, name: event.target.value }))}
                      required
                    />
                    <label htmlFor="device-type">Typ</label>
                    <input
                      id="device-type"
                      value={newDevice.type}
                      onChange={(event) => setNewDevice((prev) => ({ ...prev, type: event.target.value }))}
                      placeholder="router / switch / sensor..."
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setDeviceWizardStep(2)}
                      disabled={!newDevice.name || !newDevice.type}
                    >
                      Dalej
                    </button>
                  </>
                ) : (
                  <>
                    <label htmlFor="device-vendor">Vendor</label>
                    <input
                      id="device-vendor"
                      value={newDevice.vendor}
                      onChange={(event) => setNewDevice((prev) => ({ ...prev, vendor: event.target.value }))}
                    />
                    <label htmlFor="device-model">Model</label>
                    <input
                      id="device-model"
                      value={newDevice.model}
                      onChange={(event) => setNewDevice((prev) => ({ ...prev, model: event.target.value }))}
                    />
                    <label htmlFor="device-serial">Serial</label>
                    <input
                      id="device-serial"
                      value={newDevice.serial}
                      onChange={(event) => setNewDevice((prev) => ({ ...prev, serial: event.target.value }))}
                    />
                    <label htmlFor="device-notes">Notatki</label>
                    <input
                      id="device-notes"
                      value={newDevice.notes}
                      onChange={(event) => setNewDevice((prev) => ({ ...prev, notes: event.target.value }))}
                    />
                    <div className="wizard-actions">
                      <button type="button" className="button-secondary" onClick={() => setDeviceWizardStep(1)}>
                        Wstecz
                      </button>
                      <button type="submit" disabled={deviceSubmitting}>
                        {deviceSubmitting ? "Zapisywanie..." : "Utwórz urządzenie"}
                      </button>
                    </div>
                  </>
                )}
              </form>
            ) : null}

            {isAdmin && showConnectionWizard ? (
              <form className="inline-form" onSubmit={onCreateConnection}>
                <h4>Wizard: nowe połączenie</h4>
                <label htmlFor="from-device">FROM urządzenie</label>
                <select
                  id="from-device"
                  value={newConnection.fromDeviceId}
                  onChange={(event) =>
                    setNewConnection((prev) => ({
                      ...prev,
                      fromDeviceId: event.target.value,
                      fromInterfaceId: "",
                    }))
                  }
                  required
                >
                  <option value="">Wybierz</option>
                  {rootDevices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name}
                    </option>
                  ))}
                </select>

                <label htmlFor="from-interface">FROM interfejs</label>
                <select
                  id="from-interface"
                  value={newConnection.fromInterfaceId}
                  onChange={(event) => setNewConnection((prev) => ({ ...prev, fromInterfaceId: event.target.value }))}
                  required
                >
                  <option value="">Wybierz</option>
                  {fromInterfaces.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.type})
                    </option>
                  ))}
                </select>

                <label htmlFor="to-device">TO urządzenie</label>
                <select
                  id="to-device"
                  value={newConnection.toDeviceId}
                  onChange={(event) =>
                    setNewConnection((prev) => ({
                      ...prev,
                      toDeviceId: event.target.value,
                      toInterfaceId: "",
                    }))
                  }
                  required
                >
                  <option value="">Wybierz</option>
                  {rootDevices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name}
                    </option>
                  ))}
                </select>

                <label htmlFor="to-interface">TO interfejs</label>
                <select
                  id="to-interface"
                  value={newConnection.toInterfaceId}
                  onChange={(event) => setNewConnection((prev) => ({ ...prev, toInterfaceId: event.target.value }))}
                  required
                >
                  <option value="">Wybierz</option>
                  {toInterfaces.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.type})
                    </option>
                  ))}
                </select>

                <label htmlFor="conn-tech">Technologia</label>
                <select
                  id="conn-tech"
                  value={newConnection.technology}
                  onChange={(event) =>
                    setNewConnection((prev) => ({
                      ...prev,
                      technology: event.target.value,
                      vlanId: event.target.value === "ETHERNET" ? prev.vlanId : "",
                    }))
                  }
                >
                  <option value="ETHERNET">ETHERNET</option>
                  <option value="FIBER">FIBER</option>
                  <option value="WIFI">WIFI</option>
                  <option value="SERIAL">SERIAL</option>
                  <option value="OTHER">OTHER</option>
                </select>

                {newConnection.technology === "ETHERNET" ? (
                  <>
                    <label htmlFor="conn-vlan">VLAN</label>
                    <select
                      id="conn-vlan"
                      value={newConnection.vlanId}
                      onChange={(event) => setNewConnection((prev) => ({ ...prev, vlanId: event.target.value }))}
                      required
                    >
                      <option value="">Wybierz VLAN</option>
                      {vlans.map((vlan) => (
                        <option key={vlan.id} value={vlan.id}>
                          VLAN {vlan.vlan_id} - {vlan.name}
                        </option>
                      ))}
                    </select>
                  </>
                ) : null}

                <label htmlFor="conn-notes">Notatki</label>
                <input
                  id="conn-notes"
                  value={newConnection.notes}
                  onChange={(event) => setNewConnection((prev) => ({ ...prev, notes: event.target.value }))}
                />
                <button type="submit" disabled={connectionSubmitting}>
                  {connectionSubmitting ? "Zapisywanie..." : "Utwórz połączenie"}
                </button>
              </form>
            ) : null}

            {selectedDeviceId ? (
              <div className="device-detail">
                <h4>Szczegóły urządzenia</h4>
                {deviceDetailLoading ? <p>Ładowanie szczegółów...</p> : null}
                {deviceDetailError ? <p className="error">{deviceDetailError}</p> : null}
                {deviceDetail ? (
                  <>
                    <div className="detail-grid">
                      <p>
                        <strong>Nazwa:</strong> {deviceDetail.name}
                      </p>
                      <p>
                        <strong>Typ:</strong> {deviceDetail.type}
                      </p>
                      <p>
                        <strong>Vendor:</strong> {deviceDetail.vendor || "-"}
                      </p>
                      <p>
                        <strong>Model:</strong> {deviceDetail.model || "-"}
                      </p>
                      <p>
                        <strong>Serial:</strong> {deviceDetail.serial || "-"}
                      </p>
                    </div>
                    <h4>Interfejsy</h4>
                    {deviceDetail.interfaces.length === 0 ? <p>Brak interfejsów.</p> : null}
                    {deviceDetail.interfaces.length > 0 ? (
                      <ul className="simple-list">
                        {deviceDetail.interfaces.map((item) => (
                          <li key={item.id}>
                            <strong>{item.name}</strong> ({item.type}) {item.mac ? `- ${item.mac}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <h4>Połączenia in/out</h4>
                    {connectionsLoading ? <p>Ładowanie połączeń...</p> : null}
                    {connectionsError ? <p className="error">{connectionsError}</p> : null}
                    {!connectionsLoading && connections.length === 0 ? <p>Brak połączeń dla urządzenia.</p> : null}
                    {!connectionsLoading && connections.length > 0 ? (
                      <ul className="simple-list">
                        {connections.map((connection) => {
                          const outgoing = connection.from_device_id === selectedDeviceId;
                          const peerDeviceId = outgoing ? connection.to_device_id : connection.from_device_id;
                          const fromName = interfaceNameById.get(connection.from_interface_id) || connection.from_interface_id;
                          const toName = interfaceNameById.get(connection.to_interface_id) || connection.to_interface_id;
                          return (
                            <li key={connection.id}>
                              <strong>{outgoing ? "OUT" : "IN"}</strong> [{connection.technology}] {fromName}
                              {" -> "}
                              {toName}
                              <span className="muted"> ({deviceNameById.get(peerDeviceId) || peerDeviceId})</span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}

                    {isAdmin ? (
                      <form className="inline-form" onSubmit={onCreateInterface}>
                        <h4>Dodaj interfejs</h4>
                        <label htmlFor="int-name">Nazwa</label>
                        <input
                          id="int-name"
                          value={newInterface.name}
                          onChange={(event) => setNewInterface((prev) => ({ ...prev, name: event.target.value }))}
                          placeholder="eth0"
                          required
                        />
                        <label htmlFor="int-type">Typ</label>
                        <input
                          id="int-type"
                          value={newInterface.type}
                          onChange={(event) => setNewInterface((prev) => ({ ...prev, type: event.target.value }))}
                          placeholder="ethernet"
                          required
                        />
                        <label htmlFor="int-mac">MAC</label>
                        <input
                          id="int-mac"
                          value={newInterface.mac}
                          onChange={(event) => setNewInterface((prev) => ({ ...prev, mac: event.target.value }))}
                        />
                        <label htmlFor="int-notes">Notatki</label>
                        <input
                          id="int-notes"
                          value={newInterface.notes}
                          onChange={(event) => setNewInterface((prev) => ({ ...prev, notes: event.target.value }))}
                        />
                        <button type="submit" disabled={interfaceSubmitting}>
                          {interfaceSubmitting ? "Dodawanie..." : "Dodaj interfejs"}
                        </button>
                      </form>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="subpanel">
            <h3>Graf topologii</h3>
            <div className="graph-filters">
              <div className="field">
                <label htmlFor="graph-tech">Technologia</label>
                <select
                  id="graph-tech"
                  value={graphTechnologyFilter}
                  onChange={(event) => setGraphTechnologyFilter(event.target.value)}
                >
                  <option value="all">Wszystkie</option>
                  {graphTechnologyOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="graph-space">Przestrzeń</label>
                <select
                  id="graph-space"
                  value={graphSpaceFilter}
                  onChange={(event) => setGraphSpaceFilter(event.target.value)}
                >
                  <option value="all">Wszystkie</option>
                  {spaces.map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="graph-type">Typ urządzenia</label>
                <select
                  id="graph-type"
                  value={graphTypeFilter}
                  onChange={(event) => setGraphTypeFilter(event.target.value)}
                >
                  <option value="all">Wszystkie</option>
                  {graphTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="graph-search">
              <input
                value={graphSearch}
                onChange={(event) => setGraphSearch(event.target.value)}
                placeholder="Szukaj urządzenia..."
              />
              <button type="button" onClick={onGraphSearch}>
                Szukaj i centruj
              </button>
            </div>

            {graphLoading ? <p>Ładowanie grafu...</p> : null}
            {graphError ? <p className="error">{graphError}</p> : null}
            {!graphLoading && !graphError ? (
              <div className="graph-canvas" ref={graphContainerRef}>
                {filteredGraph.devices.length === 0 ? <p>Brak danych grafu dla wybranych filtrów.</p> : null}
              </div>
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
