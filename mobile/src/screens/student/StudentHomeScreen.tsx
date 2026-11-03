import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { useIsFocused } from "@react-navigation/native";
import { useAuth } from "../../auth/AuthContext";
import {
  getTodayAttendance,
  submitAttendance,
} from "../../api/attendance";
import { reportMissedBus } from "../../api/alerts";
import { listRoutes } from "../../api/routes";
import { getTrip, listActiveTrips } from "../../api/trips";
import SafeMapView from "../../components/SafeMapView";
import type {
  Attendance,
  AttendanceStatus,
  Route,
  Stop,
  Trip,
  TripLocation,
} from "../../types";
import {
  etaMinutes,
  haversineKm,
  isValidCoord,
} from "../../utils/geo";
import {
  GOOGLE_MAPS_KEY_MISSING_MESSAGE,
  isGoogleMapsApiKeyMissing,
} from "../../utils/googleMaps";
import {
  notifyBusApproaching,
  setupPushNotifications,
} from "../../utils/notifications";

const POLL_MS = 8000;
const PROXIMITY_KM = 1;
const PROXIMITY_ETA_MIN = 5;
const DEFAULT_REGION: Region = {
  latitude: 31.5204,
  longitude: 74.3587,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

function apiError(e: unknown, fallback: string): string {
  return (
    (e as { response?: { data?: { error?: string } }; message?: string })
      ?.response?.data?.error ||
    (e as { message?: string })?.message ||
    fallback
  );
}

function regionFromStops(stops: Stop[], bus?: TripLocation | null): Region {
  const points: { latitude: number; longitude: number }[] = [];
  for (const s of stops) {
    if (isValidCoord(s.latitude, s.longitude)) {
      points.push({ latitude: s.latitude, longitude: s.longitude });
    }
  }
  if (bus && isValidCoord(bus.latitude, bus.longitude)) {
    points.push({ latitude: bus.latitude, longitude: bus.longitude });
  }
  if (points.length === 0) return DEFAULT_REGION;

  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const midLat = (minLat + maxLat) / 2;
  const midLng = (minLng + maxLng) / 2;
  const latDelta = Math.max((maxLat - minLat) * 1.6, 0.02);
  const lngDelta = Math.max((maxLng - minLng) * 1.6, 0.02);
  return {
    latitude: midLat,
    longitude: midLng,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

export default function StudentHomeScreen() {
  const { user, studentProfile, logout, refreshProfile } = useAuth();
  const isFocused = useIsFocused();
  const [route, setRoute] = useState<Route | null>(null);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [missedBusy, setMissedBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mapGesturing, setMapGesturing] = useState(false);
  const mapRef = useRef<MapView | null>(null);
  const proximityNotifiedTrip = useRef<number | null>(null);

  const activeRouteId = studentProfile?.active_route_id ?? null;
  const myStopId = studentProfile?.stop_id ?? null;
  const stops = useMemo(
    () =>
      [...(route?.stops ?? [])].sort(
        (a, b) => a.sequence_order - b.sequence_order
      ),
    [route]
  );
  const myStop = useMemo(
    () => stops.find((s) => s.id === myStopId) ?? null,
    [stops, myStopId]
  );

  const loadStatic = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await refreshProfile();
      const routeId =
        me?.student_profile?.active_route_id ??
        studentProfile?.active_route_id ??
        null;
      const [routes, today] = await Promise.all([
        listRoutes(),
        getTodayAttendance(),
      ]);
      setAttendance(today);

      if (routeId) {
        const match = routes.find((r) => r.id === routeId);
        setRoute(match ?? null);
      } else {
        setRoute(null);
      }
    } catch (e) {
      setError(apiError(e, "Failed to load student data"));
    } finally {
      setLoading(false);
    }
  }, [refreshProfile, studentProfile?.active_route_id]);

  useEffect(() => {
    loadStatic();
  }, [loadStatic]);

  // Register push token after login / focus (for proximity + future remote push)
  useEffect(() => {
    if (!isFocused || !user) return;
    setupPushNotifications().catch(() => undefined);
  }, [isFocused, user?.id]);

  // Poll active trip for student's route while screen focused
  useEffect(() => {
    if (!isFocused || !activeRouteId) {
      setActiveTrip(null);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const trips = await listActiveTrips();
        if (cancelled) return;
        let mine =
          trips.find(
            (t) => t.route_id === activeRouteId && t.status === "active"
          ) ?? null;
        // Prefer GET /trips/:id so latest_location is always fresh for the bus pin
        if (mine?.id) {
          try {
            const fresh = await getTrip(mine.id);
            if (!cancelled && fresh) mine = fresh;
          } catch {
            // Keep list payload (already includes latest_location when available)
          }
        }
        if (!cancelled) setActiveTrip(mine);
      } catch {
        // Keep previous trip state on transient errors
      }
    };

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isFocused, activeRouteId]);

  const busLoc = activeTrip?.latest_location ?? null;
  const hasBusGps =
    busLoc != null && isValidCoord(busLoc.latitude, busLoc.longitude);
  const mapRegion = useMemo(
    () => regionFromStops(stops, busLoc),
    [stops, busLoc]
  );
  const mapFitCoords = useMemo(() => {
    const pts: { latitude: number; longitude: number }[] = [];
    for (const s of stops) {
      if (isValidCoord(s.latitude, s.longitude)) {
        pts.push({ latitude: s.latitude, longitude: s.longitude });
      }
    }
    if (hasBusGps && busLoc) {
      pts.push({ latitude: busLoc.latitude, longitude: busLoc.longitude });
    }
    return pts;
  }, [stops, hasBusGps, busLoc]);
  const mapFocusKey = `${activeRouteId}-${activeTrip?.id ?? "idle"}-${
    hasBusGps ? "bus" : "nobus"
  }-${mapFitCoords.length}`;

  const proximity = useMemo(() => {
    if (
      !busLoc ||
      !myStop ||
      !isValidCoord(busLoc.latitude, busLoc.longitude) ||
      !isValidCoord(myStop.latitude, myStop.longitude)
    ) {
      return null;
    }
    const dist = haversineKm(
      busLoc.latitude,
      busLoc.longitude,
      myStop.latitude,
      myStop.longitude
    );
    const eta = etaMinutes(dist, busLoc.speed_kmh);
    return { dist, eta };
  }, [busLoc, myStop]);

  // Local proximity notification once per trip approach (~1 km or ~5 min ETA)
  useEffect(() => {
    if (!isFocused || !activeTrip || !proximity) return;
    if (proximityNotifiedTrip.current === activeTrip.id) return;
    if (
      proximity.dist <= PROXIMITY_KM ||
      proximity.eta <= PROXIMITY_ETA_MIN
    ) {
      proximityNotifiedTrip.current = activeTrip.id;
      notifyBusApproaching({
        stopName: myStop?.name || "Your stop",
        distanceKm: proximity.dist,
        etaMin: proximity.eta,
      }).catch(() => undefined);
    }
  }, [isFocused, activeTrip?.id, proximity, myStop?.name]);

  useEffect(() => {
    if (!activeTrip) {
      proximityNotifiedTrip.current = null;
    }
  }, [activeTrip?.id]);

  async function onSetAttendance(status: AttendanceStatus) {
    if (!activeRouteId) {
      setError("No active route assigned — contact admin");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const record = await submitAttendance(status);
      setAttendance(record);
    } catch (e) {
      setError(apiError(e, "Could not update attendance"));
    } finally {
      setBusy(false);
    }
  }

  async function onMissedBus() {
    if (!activeRouteId) return;
    setMissedBusy(true);
    setError(null);
    setInfo(null);
    try {
      await reportMissedBus("Missed the bus");
      setInfo("Missed-bus alert sent to the driver.");
    } catch (e) {
      setError(apiError(e, "Could not send missed-bus alert"));
    } finally {
      setMissedBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  const status = attendance?.status ?? null;
  const tripActive = activeTrip != null;
  const mapsKeyMissing = isGoogleMapsApiKeyMissing();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      nestedScrollEnabled
      scrollEnabled={!mapGesturing}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Student Mode</Text>
      <Text style={styles.muted}>
        {studentProfile?.full_name || user?.email}
        {studentProfile?.student_number
          ? ` · ${studentProfile.student_number}`
          : ""}
      </Text>

      {!activeRouteId ? (
        <View style={styles.warnBanner}>
          <Text style={styles.warnTitle}>No route assigned</Text>
          <Text style={styles.warnBody}>
            An admin must assign an active route (and stop) before you can mark
            attendance or see the route map.
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Your route</Text>
          <Text style={styles.cardValue}>
            {route?.name ?? `Route #${activeRouteId}`}
          </Text>
          {route?.description ? (
            <Text style={styles.muted}>{route.description}</Text>
          ) : null}
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today&apos;s attendance</Text>
        <Text style={styles.muted}>
          Mandatory daily choice — Will Take Bus or Absent.
        </Text>
        <View style={styles.toggleRow}>
          <Pressable
            style={[
              styles.toggleBtn,
              status === "taking" && styles.toggleTaking,
              (!activeRouteId || busy) && styles.btnDisabled,
            ]}
            onPress={() => onSetAttendance("taking")}
            disabled={!activeRouteId || busy}
          >
            <Text
              style={[
                styles.toggleText,
                status === "taking" && styles.toggleTextActive,
              ]}
            >
              Will Take Bus
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.toggleBtn,
              status === "absent" && styles.toggleAbsent,
              (!activeRouteId || busy) && styles.btnDisabled,
            ]}
            onPress={() => onSetAttendance("absent")}
            disabled={!activeRouteId || busy}
          >
            <Text
              style={[
                styles.toggleText,
                status === "absent" && styles.toggleTextActive,
              ]}
            >
              Absent
            </Text>
          </Pressable>
        </View>
        {busy ? (
          <ActivityIndicator color="#38bdf8" style={{ marginTop: 8 }} />
        ) : status ? (
          <Text style={styles.statusHint}>
            Marked: {status === "taking" ? "Will Take Bus" : "Absent"}
          </Text>
        ) : (
          <Text style={styles.statusHint}>Not marked yet today</Text>
        )}
      </View>

      {activeRouteId ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stops</Text>
          {stops.length === 0 ? (
            <Text style={styles.muted}>No stops on this route yet.</Text>
          ) : (
            stops.map((s, idx) => (
              <View
                key={s.id}
                style={[
                  styles.stopRow,
                  myStopId === s.id && styles.stopRowMine,
                ]}
              >
                <Text style={styles.stopOrder}>{idx + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stopName}>{s.name}</Text>
                  {myStopId === s.id ? (
                    <Text style={styles.myStop}>Your stop</Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>
      ) : null}

      {activeRouteId ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Route map</Text>
          {tripActive ? (
            <Text style={styles.muted}>
              Trip #{activeTrip.id} active — refreshing every ~{POLL_MS / 1000}
              s.
            </Text>
          ) : (
            <Text style={styles.waitingText}>
              Waiting for driver to start trip
            </Text>
          )}
          {proximity && tripActive ? (
            <Text style={styles.etaText}>
              ~{proximity.dist.toFixed(1)} km to your stop
              {proximity.eta < 60
                ? ` · ~${Math.ceil(proximity.eta)} min ETA`
                : ""}
            </Text>
          ) : null}
          {mapsKeyMissing ? (
            <View style={styles.mapKeyMissing}>
              <Text style={styles.mapKeyMissingText}>
                {GOOGLE_MAPS_KEY_MISSING_MESSAGE}
              </Text>
            </View>
          ) : (
            <View style={styles.mapHost} collapsable={false}>
              <SafeMapView
                ref={mapRef}
                wrapStyle={styles.mapWrap}
                focusRegion={mapRegion}
                fitCoordinates={mapFitCoords}
                focusKey={mapFocusKey}
                scrollEnabled
                zoomEnabled
                pitchEnabled={false}
                rotateEnabled={false}
                moveOnMarkerPress={false}
                onMapGestureActive={setMapGesturing}
              >
                {stops
                  .filter((s) => isValidCoord(s.latitude, s.longitude))
                  .map((s) => (
                    <Marker
                      key={`stop-${s.id}`}
                      coordinate={{
                        latitude: s.latitude,
                        longitude: s.longitude,
                      }}
                      title={s.name}
                      description={
                        myStopId === s.id
                          ? "Your stop"
                          : `Stop ${s.sequence_order}`
                      }
                      pinColor={myStopId === s.id ? "#38bdf8" : "#94a3b8"}
                    />
                  ))}
                {tripActive && hasBusGps && busLoc ? (
                  <Marker
                    coordinate={{
                      latitude: busLoc.latitude,
                      longitude: busLoc.longitude,
                    }}
                    title="Bus"
                    description={
                      busLoc.speed_kmh != null
                        ? `${busLoc.speed_kmh.toFixed(0)} km/h`
                        : "Live location"
                    }
                    pinColor="#22c55e"
                  />
                ) : null}
              </SafeMapView>
              {stops.every((s) => !isValidCoord(s.latitude, s.longitude)) ? (
                <View style={styles.mapOverlay} pointerEvents="none">
                  <Text style={styles.mapOverlayText}>
                    No valid stop coordinates — showing default map region.
                  </Text>
                </View>
              ) : tripActive && !hasBusGps ? (
                <View style={styles.mapOverlay} pointerEvents="none">
                  <Text style={styles.mapOverlayText}>
                    Waiting for first GPS fix from the driver…
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </View>
      ) : null}

      {activeRouteId ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Missed the bus?</Text>
          <Text style={styles.muted}>
            Notify the driver on your route
            {tripActive ? " (trip is active)" : ""}.
          </Text>
          <Pressable
            style={[styles.missedBtn, missedBusy && styles.btnDisabled]}
            onPress={onMissedBus}
            disabled={missedBusy}
          >
            {missedBusy ? (
              <ActivityIndicator color="#f8fafc" />
            ) : (
              <Text style={styles.missedBtnText}>Missed Bus</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      <Pressable style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 4,
  },
  muted: {
    color: "#94a3b8",
    marginBottom: 12,
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  cardLabel: {
    color: "#94a3b8",
    fontSize: 12,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardValue: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    color: "#f8fafc",
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  toggleBtn: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#334155",
  },
  toggleTaking: {
    backgroundColor: "#14532d",
    borderColor: "#22c55e",
  },
  toggleAbsent: {
    backgroundColor: "#7f1d1d",
    borderColor: "#f87171",
  },
  toggleText: {
    color: "#cbd5e1",
    fontWeight: "700",
    fontSize: 15,
    textAlign: "center",
  },
  toggleTextActive: {
    color: "#f8fafc",
  },
  btnDisabled: {
    opacity: 0.5,
  },
  statusHint: {
    color: "#94a3b8",
    marginTop: 10,
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  stopRowMine: {
    borderWidth: 1,
    borderColor: "#38bdf8",
  },
  stopOrder: {
    color: "#38bdf8",
    fontWeight: "700",
    width: 24,
    textAlign: "center",
  },
  stopName: {
    color: "#f8fafc",
    fontWeight: "500",
  },
  myStop: {
    color: "#38bdf8",
    fontSize: 12,
    marginTop: 2,
  },
  waitingText: {
    color: "#fbbf24",
    marginBottom: 10,
    fontWeight: "600",
  },
  etaText: {
    color: "#86efac",
    marginBottom: 10,
    fontWeight: "600",
  },
  mapHost: {
    height: 280,
    width: "100%",
    position: "relative",
  },
  mapWrap: {
    height: 280,
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1e293b",
  },
  mapKeyMissing: {
    minHeight: 120,
    width: "100%",
    borderRadius: 12,
    backgroundColor: "#422006",
    borderWidth: 1,
    borderColor: "#fbbf24",
    padding: 16,
    justifyContent: "center",
  },
  mapKeyMissingText: {
    color: "#fde68a",
    textAlign: "center",
    lineHeight: 20,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  mapOverlayText: {
    color: "#e2e8f0",
    textAlign: "center",
  },
  missedBtn: {
    backgroundColor: "#b45309",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  missedBtnText: {
    color: "#f8fafc",
    fontWeight: "700",
    fontSize: 16,
  },
  warnBanner: {
    backgroundColor: "#422006",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  warnTitle: {
    color: "#fbbf24",
    fontWeight: "700",
    marginBottom: 4,
  },
  warnBody: {
    color: "#fde68a",
    lineHeight: 20,
  },
  error: {
    color: "#f87171",
    marginBottom: 12,
  },
  info: {
    color: "#86efac",
    marginBottom: 12,
  },
  logoutBtn: {
    backgroundColor: "#334155",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  logoutText: {
    color: "#f8fafc",
    fontWeight: "600",
  },
});
