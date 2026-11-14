import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { AdminOutletContext } from "../components/AdminLayout";
import { useAuth } from "../auth/AuthContext";
import { getErrorMessage } from "../api/client";
import { listBuses } from "../api/buses";
import { listDrivers } from "../api/drivers";
import { listRoutes } from "../api/routes";
import {
  createLiveSocket,
  type TripLocationEvent,
} from "../api/socket";
import { listActiveTrips } from "../api/trips";
import type { Bus, Driver, Route, Trip } from "../api/types";

const POLL_MS = 6000;
const SLOW_POLL_MS = 30000;
const DEFAULT_CENTER: [number, number] = [31.5204, 74.3587];
const FOCUS_ZOOM = 15;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function busDivIcon(busNumber: string) {
  const label = escapeHtml(busNumber || "Bus");
  return L.divIcon({
    className: "bus-marker-icon",
    html: `<div class="bus-marker-badge" title="${label}"><span class="bus-marker-dot"></span><span class="bus-marker-label">${label}</span></div>`,
    iconSize: [64, 36],
    iconAnchor: [32, 18],
    popupAnchor: [0, -20],
  });
}

function tripPoints(trips: Trip[]): [number, number][] {
  return trips
    .map((t) => t.latest_location)
    .filter(
      (loc): loc is NonNullable<typeof loc> =>
        !!loc &&
        Number.isFinite(loc.latitude) &&
        Number.isFinite(loc.longitude)
    )
    .map((loc) => [loc.latitude, loc.longitude] as [number, number]);
}

function fitTrips(map: L.Map, trips: Trip[]) {
  const pts = tripPoints(trips);
  if (pts.length === 0) return;
  if (pts.length === 1) {
    map.setView(pts[0], FOCUS_ZOOM);
    return;
  }
  map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: FOCUS_ZOOM });
}

type CameraCommand =
  | { kind: "fit-all"; token: number }
  | { kind: "focus"; token: number; tripId: number };

function MapCamera({
  located,
  command,
  followModeRef,
  onUserInteract,
  markerRefs,
}: {
  located: Trip[];
  command: CameraCommand | null;
  followModeRef: React.MutableRefObject<boolean>;
  onUserInteract: () => void;
  markerRefs: React.MutableRefObject<Map<number, L.Marker>>;
}) {
  const map = useMap();
  const didInitialFit = useRef(false);
  const lastCommandToken = useRef<number | null>(null);
  const programmaticMove = useRef(false);

  const runCamera = useCallback((fn: () => void) => {
    programmaticMove.current = true;
    fn();
    window.setTimeout(() => {
      programmaticMove.current = false;
    }, 400);
  }, []);

  useEffect(() => {
    const mark = () => {
      if (programmaticMove.current) return;
      onUserInteract();
    };
    map.on("dragstart", mark);
    map.on("zoomstart", mark);
    return () => {
      map.off("dragstart", mark);
      map.off("zoomstart", mark);
    };
  }, [map, onUserInteract]);

  // One-shot auto-fit when GPS markers first appear (only if user hasn't panned/zoomed)
  useEffect(() => {
    if (didInitialFit.current || !followModeRef.current) return;
    if (located.length === 0) return;
    didInitialFit.current = true;
    runCamera(() => fitTrips(map, located));
  }, [map, located, followModeRef, runCamera]);

  // Explicit Recenter / search focus — never re-run on raw trip GPS churn
  useEffect(() => {
    if (!command) return;
    if (lastCommandToken.current === command.token) return;
    lastCommandToken.current = command.token;

    if (command.kind === "fit-all") {
      followModeRef.current = true;
      runCamera(() => fitTrips(map, located));
      return;
    }

    const trip = located.find((t) => t.id === command.tripId);
    const loc = trip?.latest_location;
    if (!loc) return;
    followModeRef.current = true;
    runCamera(() => {
      map.setView([loc.latitude, loc.longitude], FOCUS_ZOOM, { animate: true });
    });
    window.setTimeout(() => {
      markerRefs.current.get(command.tripId)?.openPopup();
    }, 180);
  }, [command, map, located, followModeRef, markerRefs, runCamera]);

  return null;
}

function applyLocationEvent(trips: Trip[], ev: TripLocationEvent): Trip[] {
  const loc = {
    id: 0,
    trip_id: ev.trip_id,
    latitude: ev.latitude,
    longitude: ev.longitude,
    speed_kmh: ev.speed_kmh,
    recorded_at: ev.recorded_at,
  };
  const idx = trips.findIndex((t) => t.id === ev.trip_id);
  if (idx >= 0) {
    const next = [...trips];
    next[idx] = { ...next[idx], latest_location: loc };
    return next;
  }
  return [
    ...trips,
    {
      id: ev.trip_id,
      bus_id: ev.bus_id,
      driver_id: 0,
      route_id: ev.route_id,
      status: "active",
      started_at: null,
      ended_at: null,
      latest_location: loc,
    },
  ];
}

export default function LiveMapPage() {
  const { token } = useAuth();
  const { fleetSearch } = useOutletContext<AdminOutletContext>();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [liveMode, setLiveMode] = useState<"socket" | "poll">("poll");
  const [searchMiss, setSearchMiss] = useState(false);
  const [cameraCommand, setCameraCommand] = useState<CameraCommand | null>(null);

  const socketConnectedRef = useRef(false);
  const lastSlowPollRef = useRef(0);
  const followModeRef = useRef(true);
  const markerRefs = useRef<Map<number, L.Marker>>(new Map());
  const iconCache = useRef<Map<string, L.DivIcon>>(new Map());

  const onUserInteract = useCallback(() => {
    followModeRef.current = false;
  }, []);

  const requestFitAll = useCallback(() => {
    followModeRef.current = true;
    setCameraCommand({ kind: "fit-all", token: Date.now() });
  }, []);

  const getIcon = useCallback((busNumber: string) => {
    const key = busNumber || "Bus";
    let icon = iconCache.current.get(key);
    if (!icon) {
      icon = busDivIcon(key);
      iconCache.current.set(key, icon);
    }
    return icon;
  }, []);

  const refreshMeta = useCallback(async () => {
    try {
      const [b, d, r] = await Promise.all([
        listBuses(),
        listDrivers(),
        listRoutes(),
      ]);
      setBuses(b);
      setDrivers(d);
      setRoutes(r);
    } catch {
      // Non-fatal — markers still show trip ids
    }
  }, []);

  const refreshTrips = useCallback(async () => {
    try {
      const list = await listActiveTrips();
      setTrips(list);
      setUpdatedAt(new Date().toLocaleTimeString());
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    refreshMeta();
    refreshTrips();
  }, [refreshMeta, refreshTrips]);

  // Socket.IO live updates; HTTP poll fallback when disconnected
  useEffect(() => {
    if (!token) return;

    const socket = createLiveSocket(token);
    let cancelled = false;

    const onConnect = () => {
      if (cancelled) return;
      socketConnectedRef.current = true;
      setLiveMode("socket");
      socket.emit(
        "join",
        { room: "university" },
        (ack: { ok?: boolean; error?: string } | undefined) => {
          if (ack && ack.ok === false) {
            setError(ack.error || "Live connection join failed");
          }
        }
      );
    };

    const onDisconnect = () => {
      if (cancelled) return;
      socketConnectedRef.current = false;
      setLiveMode("poll");
    };

    const onLocation = (ev: TripLocationEvent) => {
      if (cancelled) return;
      if (
        !Number.isFinite(ev.latitude) ||
        !Number.isFinite(ev.longitude) ||
        !ev.trip_id
      ) {
        return;
      }
      setTrips((prev) => applyLocationEvent(prev, ev));
      setUpdatedAt(new Date().toLocaleTimeString());
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("trip_location", onLocation);
    socket.connect();

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      if (socketConnectedRef.current) {
        if (now - lastSlowPollRef.current >= SLOW_POLL_MS) {
          lastSlowPollRef.current = now;
          void refreshTrips();
        }
      } else {
        void refreshTrips();
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("trip_location", onLocation);
      socket.disconnect();
      socketConnectedRef.current = false;
    };
  }, [token, refreshTrips]);

  const busById = useMemo(() => new Map(buses.map((b) => [b.id, b])), [buses]);
  const driverById = useMemo(
    () => new Map(drivers.map((d) => [d.id, d])),
    [drivers]
  );
  const routeById = useMemo(
    () => new Map(routes.map((r) => [r.id, r])),
    [routes]
  );

  const busLabel = useCallback(
    (id: number) => busById.get(id)?.bus_number || `Bus #${id}`,
    [busById]
  );
  const driverLabel = useCallback(
    (id: number) => driverById.get(id)?.full_name || `Driver #${id}`,
    [driverById]
  );
  const routeLabel = useCallback(
    (id: number) => routeById.get(id)?.name || `Route #${id}`,
    [routeById]
  );

  const located = useMemo(
    () =>
      trips.filter(
        (t) =>
          t.latest_location &&
          Number.isFinite(t.latest_location.latitude) &&
          Number.isFinite(t.latest_location.longitude)
      ),
    [trips]
  );

  // Topbar search → focus matching bus / route once per query (not on GPS churn)
  const lastFocusedQuery = useRef("");
  useEffect(() => {
    const q = fleetSearch.trim().toLowerCase();
    if (!q) {
      lastFocusedQuery.current = "";
      setSearchMiss(false);
      return;
    }

    const handle = window.setTimeout(() => {
      const match = located.find((t) => {
        const bus = busLabel(t.bus_id).toLowerCase();
        const route = routeLabel(t.route_id).toLowerCase();
        return bus.includes(q) || route.includes(q);
      });

      if (!match) {
        setSearchMiss(true);
        return;
      }

      setSearchMiss(false);
      if (q === lastFocusedQuery.current) return;
      lastFocusedQuery.current = q;
      followModeRef.current = true;
      setCameraCommand({
        kind: "focus",
        token: Date.now(),
        tripId: match.id,
      });
    }, 280);

    return () => window.clearTimeout(handle);
  }, [fleetSearch, located, busLabel, routeLabel]);

  const activeLabel =
    trips.length === 1 ? "1 Active Bus" : `${trips.length} Active Buses`;
  const gpsLabel =
    located.length === 1 ? "1 with GPS" : `${located.length} with GPS`;

  return (
    <div>
      <div className="page-header">
        <h1>Live Fleet Map</h1>
        <p className="muted">
          Real-time GPS tracking of active university buses and route corridors.
        </p>
      </div>

      <div className="live-map-toolbar">
        <div className="live-map-pills" aria-live="polite">
          <span
            className={
              liveMode === "socket"
                ? "live-status-pill live-status-pill--live"
                : "live-status-pill live-status-pill--poll"
            }
          >
            {liveMode === "socket" ? "Live Tracking" : "Updating"}
          </span>
          <span className="live-status-pill">{activeLabel}</span>
          <span className="live-status-pill">{gpsLabel}</span>
          {updatedAt ? (
            <span className="live-status-pill">Updated {updatedAt}</span>
          ) : null}
        </div>
        <div className="row-actions">
          <button
            type="button"
            className="ghost small-btn"
            onClick={() => refreshTrips()}
          >
            Refresh now
          </button>
          <button
            type="button"
            className="ghost small-btn"
            onClick={requestFitAll}
            disabled={located.length === 0}
          >
            Recenter
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {searchMiss ? (
        <p className="live-map-search-miss muted">No matching active bus</p>
      ) : null}

      <div className="live-map">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapCamera
            located={located}
            command={cameraCommand}
            followModeRef={followModeRef}
            onUserInteract={onUserInteract}
            markerRefs={markerRefs}
          />
          {located.map((t) => {
            const loc = t.latest_location!;
            const number = busLabel(t.bus_id);
            const speed =
              loc.speed_kmh != null && Number.isFinite(loc.speed_kmh)
                ? `${loc.speed_kmh.toFixed(0)} km/h`
                : "—";
            return (
              <Marker
                key={t.id}
                position={[loc.latitude, loc.longitude]}
                icon={getIcon(number)}
                ref={(marker) => {
                  if (marker) markerRefs.current.set(t.id, marker);
                  else markerRefs.current.delete(t.id);
                }}
              >
                <Popup className="bus-popup">
                  <div className="bus-popup-card">
                    <p className="bus-popup-number">{number}</p>
                    <dl className="bus-popup-meta">
                      <div>
                        <dt>Driver</dt>
                        <dd>{driverLabel(t.driver_id)}</dd>
                      </div>
                      <div>
                        <dt>Route</dt>
                        <dd>{routeLabel(t.route_id)}</dd>
                      </div>
                      <div>
                        <dt>Live Speed</dt>
                        <dd>{speed}</dd>
                      </div>
                    </dl>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {trips.length === 0 && !error ? (
        <p className="muted" style={{ marginTop: 12 }}>
          No active trips right now. Start a driver trip to see markers.
        </p>
      ) : null}
    </div>
  );
}
