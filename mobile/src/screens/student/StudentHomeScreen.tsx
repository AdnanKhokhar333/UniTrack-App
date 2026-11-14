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
import { Ionicons } from "@expo/vector-icons";
import {
  useIsFocused,
  useNavigation,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/AuthContext";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import {
  getTodayAttendance,
  submitAttendance,
} from "../../api/attendance";
import { reportMissedBus } from "../../api/alerts";
import { listRoutes } from "../../api/routes";
import {
  createLiveSocket,
  type TripLocationEvent,
} from "../../api/socket";
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
import { toTitleCase } from "../../utils/format";
import {
  GOOGLE_MAPS_KEY_MISSING_MESSAGE,
  isGoogleMapsApiKeyMissing,
} from "../../utils/googleMaps";
import {
  notifyBusApproaching,
  setupPushNotifications,
} from "../../utils/notifications";
import { colors, radius } from "../../theme";

const POLL_MS = 8000;
const SLOW_POLL_MS = 30000;
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
  const { user, token, studentProfile, logout, refreshProfile } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
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
  const socketConnectedRef = useRef(false);
  const lastSlowPollRef = useRef(0);

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

  const displayName = useMemo(() => {
    const raw = studentProfile?.full_name?.trim();
    if (!raw) return user?.email ?? "Student";
    return toTitleCase(raw);
  }, [studentProfile?.full_name, user?.email]);

  const passApproved =
    user?.is_approved ?? studentProfile?.is_approved ?? false;

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

  // Live bus location: Socket.IO while map focused; HTTP poll fallback if socket down
  useEffect(() => {
    if (!isFocused || !activeRouteId) {
      setActiveTrip(null);
      return;
    }

    let cancelled = false;
    socketConnectedRef.current = false;
    lastSlowPollRef.current = 0;

    const poll = async () => {
      try {
        const trips = await listActiveTrips();
        if (cancelled) return;
        let mine =
          trips.find(
            (t) => t.route_id === activeRouteId && t.status === "active"
          ) ?? null;
        if (mine?.id) {
          try {
            const fresh = await getTrip(mine.id);
            if (!cancelled && fresh) mine = fresh;
          } catch {
            // Keep list payload
          }
        }
        if (!cancelled) setActiveTrip(mine);
      } catch {
        // Keep previous trip state on transient errors
      }
    };

    const applySocketLocation = (ev: TripLocationEvent) => {
      if (cancelled || ev.route_id !== activeRouteId) return;
      if (
        !Number.isFinite(ev.latitude) ||
        !Number.isFinite(ev.longitude) ||
        !ev.trip_id
      ) {
        return;
      }
      setActiveTrip((prev) => {
        const loc: TripLocation = {
          id: prev?.latest_location?.id ?? 0,
          trip_id: ev.trip_id,
          latitude: ev.latitude,
          longitude: ev.longitude,
          speed_kmh: ev.speed_kmh,
          recorded_at: ev.recorded_at,
        };
        if (prev && prev.id === ev.trip_id) {
          return { ...prev, latest_location: loc };
        }
        return {
          id: ev.trip_id,
          bus_id: ev.bus_id,
          driver_id: prev?.driver_id ?? 0,
          route_id: ev.route_id,
          status: "active",
          started_at: prev?.started_at ?? null,
          ended_at: null,
          latest_location: loc,
        };
      });
    };

    void poll();

    let socket: ReturnType<typeof createLiveSocket> | null = null;
    if (token) {
      socket = createLiveSocket(token);
      socket.on("connect", () => {
        if (cancelled) return;
        socketConnectedRef.current = true;
        socket?.emit(
          "join",
          { room: "route", route_id: activeRouteId },
          (_ack: { ok?: boolean } | undefined) => undefined
        );
      });
      socket.on("disconnect", () => {
        socketConnectedRef.current = false;
      });
      socket.on("trip_location", applySocketLocation);
      socket.connect();
    }

    const id = setInterval(() => {
      const now = Date.now();
      if (socketConnectedRef.current) {
        if (now - lastSlowPollRef.current >= SLOW_POLL_MS) {
          lastSlowPollRef.current = now;
          void poll();
        }
      } else {
        void poll();
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
      socketConnectedRef.current = false;
      if (socket) {
        socket.off("trip_location", applySocketLocation);
        socket.disconnect();
      }
    };
  }, [isFocused, activeRouteId, token]);

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
        <ActivityIndicator size="large" color={colors.ctaIndigoMid} />
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
      <View style={styles.headerRow}>
        <Text style={styles.title}>Student Ops</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log out"
          hitSlop={8}
          onPress={logout}
          style={styles.logoutIconBtn}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.muted} />
        </Pressable>
      </View>

      <Text style={styles.profileLine}>
        {displayName}
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
          <View style={styles.routeRow}>
            <View style={styles.routeIconBadge}>
              <Ionicons name="bus" size={18} color={colors.onFilled} />
            </View>
            <View style={styles.routeTextCol}>
              <Text style={styles.cardValue}>
                {route?.name ?? `Route #${activeRouteId}`}
              </Text>
              {route?.description ? (
                <Text style={styles.routeDesc}>{route.description}</Text>
              ) : null}
            </View>
            <View
              style={[
                styles.passPill,
                passApproved ? styles.passPillActive : styles.passPillRevoked,
              ]}
            >
              <Text
                style={[
                  styles.passPillText,
                  passApproved
                    ? styles.passPillTextActive
                    : styles.passPillTextRevoked,
                ]}
              >
                {passApproved ? "• Active Pass" : "• Pass Revoked"}
              </Text>
            </View>
          </View>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}

      <View style={styles.quickRow}>
        <Pressable
          style={styles.quickBtn}
          onPress={() => navigation.navigate("BusPass")}
        >
          <Ionicons
            name="qr-code-outline"
            size={18}
            color={colors.ctaIndigoMid}
          />
          <Text style={styles.quickBtnText}>Bus Pass</Text>
        </Pressable>
        <Pressable
          style={styles.quickBtn}
          onPress={() => navigation.navigate("Feedback")}
        >
          <Ionicons
            name="star-outline"
            size={18}
            color={colors.ctaIndigoMid}
          />
          <Text style={styles.quickBtnText}>Rate / Complaint</Text>
        </Pressable>
      </View>

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
          <ActivityIndicator
            color={colors.ctaIndigoMid}
            style={{ marginTop: 8 }}
          />
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
            stops.map((s, idx) => {
              const mine = myStopId === s.id;
              return (
                <View
                  key={s.id}
                  style={[styles.stopRow, mine && styles.stopRowMine]}
                >
                  {mine ? (
                    <View style={styles.stopPinBadge}>
                      <Ionicons
                        name="location"
                        size={16}
                        color={colors.onFilled}
                      />
                    </View>
                  ) : (
                    <Text style={styles.stopOrder}>{idx + 1}</Text>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stopName}>{s.name}</Text>
                    {mine ? (
                      <Text style={styles.myStop}>Your stop</Text>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </View>
      ) : null}

      {activeRouteId ? (
        <View style={styles.section}>
          <View style={styles.mapHeaderRow}>
            <Text style={[styles.sectionTitle, styles.mapSectionTitle]}>
              Route map
            </Text>
            {tripActive ? (
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>
                  • Trip #{activeTrip.id} Live
                </Text>
              </View>
            ) : (
              <Text style={styles.waitingText}>Waiting for driver trip</Text>
            )}
          </View>
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
                      pinColor={
                        myStopId === s.id
                          ? colors.ctaIndigoMid
                          : colors.muted
                      }
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
                    pinColor={colors.success}
                  />
                ) : null}
              </SafeMapView>
              {stops.every((s) => !isValidCoord(s.latitude, s.longitude)) ? (
                <View style={styles.mapOverlayPill} pointerEvents="none">
                  <Text style={styles.mapOverlayPillText}>
                    No valid stop coordinates
                  </Text>
                </View>
              ) : tripActive && !hasBusGps ? (
                <View style={styles.mapOverlayPill} pointerEvents="none">
                  <Text style={styles.mapOverlayPillText}>
                    Waiting for driver GPS…
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
              <ActivityIndicator color={colors.onFilled} />
            ) : (
              <View style={styles.btnContent}>
                <Ionicons
                  name="notifications-outline"
                  size={18}
                  color={colors.onFilled}
                />
                <Text style={styles.missedBtnText}>Missed Bus</Text>
              </View>
            )}
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    flexShrink: 1,
  },
  logoutIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileLine: {
    color: colors.brandWordmark,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 14,
  },
  muted: {
    color: colors.muted,
    marginBottom: 12,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 16,
  },
  cardLabel: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  routeIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ctaIndigo,
  },
  routeTextCol: {
    flex: 1,
    minWidth: 0,
  },
  cardValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  routeDesc: {
    color: colors.muted,
    marginTop: 2,
    fontSize: 13,
  },
  passPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    flexShrink: 0,
  },
  passPillActive: {
    backgroundColor: colors.successSoft,
    borderColor: "rgba(34, 197, 94, 0.45)",
  },
  passPillRevoked: {
    backgroundColor: colors.dangerSoft,
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  passPillText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  passPillTextActive: {
    color: colors.accentGreen,
  },
  passPillTextRevoked: {
    color: colors.danger,
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 8,
  },
  quickRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  quickBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    backgroundColor: colors.indigoSoft,
    borderRadius: radius,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.ctaIndigoMid,
  },
  quickBtnText: {
    color: colors.ctaIndigoMid,
    fontWeight: "700",
    fontSize: 13,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  toggleBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius,
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.border,
  },
  toggleTaking: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  toggleAbsent: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  toggleText: {
    color: colors.muted,
    fontWeight: "700",
    fontSize: 15,
    textAlign: "center",
  },
  toggleTextActive: {
    color: colors.text,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  statusHint: {
    color: colors.muted,
    marginTop: 10,
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius,
    padding: 12,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stopRowMine: {
    borderWidth: 1.5,
    borderColor: colors.ctaIndigoMid,
    backgroundColor: colors.indigoSoft,
  },
  stopPinBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ctaIndigoMid,
  },
  stopOrder: {
    color: colors.ctaIndigoMid,
    fontWeight: "700",
    width: 24,
    textAlign: "center",
  },
  stopName: {
    color: colors.text,
    fontWeight: "500",
  },
  myStop: {
    color: colors.ctaIndigoMid,
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600",
  },
  mapHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  mapSectionTitle: {
    marginBottom: 0,
  },
  liveBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.45)",
  },
  liveBadgeText: {
    color: colors.accentGreen,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  waitingText: {
    color: colors.muted,
    fontWeight: "600",
    fontSize: 13,
  },
  etaText: {
    color: colors.success,
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
    borderRadius: radius,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapKeyMissing: {
    minHeight: 120,
    width: "100%",
    borderRadius: radius,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: 16,
    justifyContent: "center",
  },
  mapKeyMissingText: {
    color: colors.warning,
    textAlign: "center",
    lineHeight: 20,
  },
  mapOverlayPill: {
    position: "absolute",
    top: 12,
    alignSelf: "center",
    left: 16,
    right: 16,
    backgroundColor: "rgba(11, 14, 20, 0.82)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  mapOverlayPillText: {
    color: colors.onFilled,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  missedBtn: {
    backgroundColor: "rgba(185, 28, 28, 0.85)",
    borderRadius: radius,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.55)",
  },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  missedBtnText: {
    color: colors.onFilled,
    fontWeight: "700",
    fontSize: 16,
  },
  warnBanner: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius,
    padding: 14,
    marginBottom: 16,
  },
  warnTitle: {
    color: colors.warning,
    fontWeight: "700",
    marginBottom: 4,
  },
  warnBody: {
    color: colors.warning,
    lineHeight: 20,
  },
  error: {
    color: colors.danger,
    marginBottom: 12,
  },
  info: {
    color: colors.success,
    marginBottom: 12,
  },
});
