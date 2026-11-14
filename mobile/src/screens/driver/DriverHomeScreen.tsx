import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import * as Location from "expo-location";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useAuth } from "../../auth/AuthContext";
import {
  acknowledgeMissedBus,
  listActiveMissedBusAlerts,
  sendSos,
} from "../../api/alerts";
import { getBus } from "../../api/buses";
import { getRouteAttendance } from "../../api/attendance";
import { listRoutes } from "../../api/routes";
import {
  endTrip,
  getMyActiveTrip,
  postTripLocation,
  startTrip,
} from "../../api/trips";
import SafeMapView from "../../components/SafeMapView";
import type {
  Bus,
  MissedBusAlert,
  Route,
  RouteAttendanceSummary,
  Stop,
  Trip,
} from "../../types";
import { isValidCoord } from "../../utils/geo";
import {
  GOOGLE_MAPS_KEY_MISSING_MESSAGE,
  isGoogleMapsApiKeyMissing,
} from "../../utils/googleMaps";
import {
  setBackgroundTripId,
  startBackgroundLocation,
  stopBackgroundLocation,
} from "../../utils/backgroundLocation";
import {
  enqueueLocation,
  flushLocationQueue,
} from "../../utils/locationQueue";
import { setupPushNotifications } from "../../utils/notifications";
import { colors, radius } from "../../theme";

const LOCATION_INTERVAL_MS = 7000;
const MISSED_POLL_MS = 5000;
const SPEED_WARN_KMH = 70;
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

/** Proper Title Case for driver display names (e.g. rizwan khokhar → Rizwan Khokhar). */
function toTitleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function regionFromPoints(
  stops: Stop[],
  driverLat?: number | null,
  driverLng?: number | null
): Region {
  const points: { latitude: number; longitude: number }[] = [];
  for (const s of stops) {
    if (isValidCoord(s.latitude, s.longitude)) {
      points.push({ latitude: s.latitude, longitude: s.longitude });
    }
  }
  if (isValidCoord(driverLat, driverLng)) {
    points.push({ latitude: driverLat!, longitude: driverLng! });
  }
  if (points.length === 0) return DEFAULT_REGION;

  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.02),
    longitudeDelta: Math.max((maxLng - minLng) * 1.6, 0.02),
  };
}

export default function DriverHomeScreen() {
  const { user, driverProfile, logout } = useAuth();
  const isFocused = useIsFocused();
  const [bus, setBus] = useState<Bus | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [attendance, setAttendance] = useState<RouteAttendanceSummary | null>(
    null
  );
  const [speeding, setSpeeding] = useState(false);
  const [lastSpeed, setLastSpeed] = useState<number | null>(null);
  const [driverLat, setDriverLat] = useState<number | null>(null);
  const [driverLng, setDriverLng] = useState<number | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [gpsHint, setGpsHint] = useState<string | null>(null);
  const [locationSyncNote, setLocationSyncNote] = useState<string | null>(null);
  const [bgNote, setBgNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sosBusy, setSosBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mapGesturing, setMapGesturing] = useState(false);
  const [missedAlerts, setMissedAlerts] = useState<MissedBusAlert[]>([]);
  const [activeMissed, setActiveMissed] = useState<MissedBusAlert | null>(null);
  const tripRef = useRef<Trip | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const alertedMissedIds = useRef<Set<number>>(new Set());
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    tripRef.current = trip;
  }, [trip]);

  useEffect(() => {
    if (!isFocused || !user) return;
    setupPushNotifications().catch(() => undefined);
  }, [isFocused, user?.id]);

  const loadAttendance = useCallback(async (routeId: number) => {
    try {
      const summary = await getRouteAttendance(routeId);
      setAttendance(summary);
    } catch {
      // Non-fatal
    }
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [routeList, active] = await Promise.all([
        listRoutes(),
        getMyActiveTrip(),
      ]);
      setRoutes(routeList.filter((r) => r.is_active));

      if (driverProfile?.bus_id) {
        try {
          const b = await getBus(driverProfile.bus_id);
          setBus(b);
        } catch {
          setBus(null);
        }
      }

      if (active) {
        setTrip(active);
        setSelectedRouteId(active.route_id);
        const loc = active.latest_location;
        if (loc && isValidCoord(loc.latitude, loc.longitude)) {
          setDriverLat(loc.latitude);
          setDriverLng(loc.longitude);
        }
      } else if (routeList.length > 0) {
        setSelectedRouteId((prev) => prev ?? routeList[0].id);
      }
    } catch (e) {
      setError(apiError(e, "Failed to load driver data"));
    } finally {
      setLoading(false);
    }
  }, [driverProfile?.bus_id]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Foreground GPS + offline flush while trip is active
  useEffect(() => {
    if (!trip || trip.status !== "active") {
      setSpeeding(false);
      setLastSpeed(null);
      setGpsHint(null);
      setLocationSyncNote(null);
      stopBackgroundLocation().catch(() => undefined);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== "granted") {
        setLocationDenied(true);
        setGpsHint(
          "Location permission denied — enable location so the bus can be tracked."
        );
        return;
      }
      setLocationDenied(false);
      setGpsHint(null);

      await setBackgroundTripId(trip.id);
      const bg = await startBackgroundLocation();
      if (!cancelled) {
        if (bg.ok) {
          setBgNote("Background location enabled (minimized / locked).");
        } else if (bg.reason === "background_denied") {
          setBgNote(
            "Background location denied — tracking continues only while the app is open. Fully-killed GPS is limited on Expo Go."
          );
        } else {
          setBgNote(null);
        }
      }

      const tick = async () => {
        const active = tripRef.current;
        if (!active || cancelled) return;
        try {
          await flushLocationQueue();
          if (!cancelled) setLocationSyncNote(null);
        } catch {
          // keep sync note from last post failure
        }
        try {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const rawMs = pos.coords.speed;
          const speedKmh =
            rawMs != null && rawMs >= 0 ? rawMs * 3.6 : 0;

          if (cancelled) return;

          if (!isValidCoord(lat, lng)) {
            setGpsHint(
              "GPS returned invalid coordinates (0,0). Enable location, go outdoors, or set a mock location on the emulator."
            );
            return;
          }

          setGpsHint(null);
          setDriverLat(lat);
          setDriverLng(lng);
          setLastSpeed(speedKmh);
          setSpeeding(speedKmh > SPEED_WARN_KMH);

          try {
            const result = await postTripLocation(active.id, {
              latitude: lat,
              longitude: lng,
              speed_kmh: speedKmh,
            });
            if (cancelled) return;
            setLocationSyncNote(null);
            setLastSpeed(result.location.speed_kmh ?? speedKmh);
            setSpeeding(
              result.speeding === true ||
                (result.location.speed_kmh ?? speedKmh) > SPEED_WARN_KMH
            );
            await flushLocationQueue();
          } catch {
            await enqueueLocation({
              tripId: active.id,
              latitude: lat,
              longitude: lng,
              speed_kmh: speedKmh,
              queued_at: new Date().toISOString(),
            });
            if (!cancelled) {
              setLocationSyncNote(
                "Location queued / sync failed — will retry. Check EXPO_PUBLIC_API_URL and that the backend is reachable."
              );
            }
          }
        } catch {
          if (!cancelled) {
            setGpsHint(
              "Could not read GPS — enable location, go outdoors, or set an emulator mock location."
            );
          }
        }
      };

      await tick();
      timer = setInterval(tick, LOCATION_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [trip?.id, trip?.status]);

  // Poll missed-bus alerts while trip active
  useEffect(() => {
    if (!trip || trip.status !== "active" || !isFocused) {
      setMissedAlerts([]);
      setActiveMissed(null);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const alerts = await listActiveMissedBusAlerts();
        if (cancelled) return;
        setMissedAlerts(alerts);
        const fresh = alerts.find((a) => !alertedMissedIds.current.has(a.id));
        if (fresh) {
          alertedMissedIds.current.add(fresh.id);
          setActiveMissed(fresh);
          playMissedAlertSound().catch(() => undefined);
        }
      } catch {
        // keep previous
      }
    };

    poll();
    const id = setInterval(poll, MISSED_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [trip?.id, trip?.status, isFocused]);

  async function playMissedAlertSound() {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync(
        {
          uri: "https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg",
        },
        { shouldPlay: true, volume: 1.0, isLooping: false }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((st) => {
        if (st.isLoaded && st.didJustFinish) {
          sound.unloadAsync().catch(() => undefined);
          if (soundRef.current === sound) soundRef.current = null;
        }
      });
    } catch {
      // Modal still shows; sound is best-effort
    }
  }

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => undefined);
    };
  }, []);

  // Attendance refresh
  useEffect(() => {
    const routeId = trip?.status === "active" ? trip.route_id : selectedRouteId;
    if (!routeId) {
      setAttendance(null);
      return;
    }
    loadAttendance(routeId);
    if (trip?.status !== "active") return;
    const id = setInterval(
      () => loadAttendance(routeId),
      LOCATION_INTERVAL_MS * 2
    );
    return () => clearInterval(id);
  }, [trip?.id, trip?.status, trip?.route_id, selectedRouteId, loadAttendance]);

  const selectedRoute = routes.find((r) => r.id === selectedRouteId);
  const mapStops = useMemo(() => {
    const r =
      trip?.status === "active"
        ? routes.find((x) => x.id === trip.route_id) ?? selectedRoute
        : selectedRoute;
    return [...(r?.stops ?? [])].sort(
      (a, b) => a.sequence_order - b.sequence_order
    );
  }, [routes, trip, selectedRoute]);

  const mapRegion = useMemo(
    () => regionFromPoints(mapStops, driverLat, driverLng),
    [mapStops, driverLat, driverLng]
  );
  const hasDriverGps = isValidCoord(driverLat, driverLng);
  const mapFitCoords = useMemo(() => {
    const pts: { latitude: number; longitude: number }[] = [];
    for (const s of mapStops) {
      if (isValidCoord(s.latitude, s.longitude)) {
        pts.push({ latitude: s.latitude, longitude: s.longitude });
      }
    }
    if (hasDriverGps) {
      pts.push({ latitude: driverLat!, longitude: driverLng! });
    }
    return pts;
  }, [mapStops, hasDriverGps, driverLat, driverLng]);

  const tripActive = trip?.status === "active";
  const mapFocusKey = `${trip?.id ?? selectedRouteId ?? "idle"}-${
    hasDriverGps ? "gps" : "nogps"
  }-${mapFitCoords.length}`;
  const previewFocusKey = `preview-${selectedRouteId ?? "none"}-${mapFitCoords.length}`;

  const displayName = useMemo(() => {
    const raw = driverProfile?.full_name?.trim() || user?.email || "Driver";
    if (raw.includes("@")) return raw;
    return toTitleCase(raw);
  }, [driverProfile?.full_name, user?.email]);

  const takingStudents = attendance?.taking ?? [];
  const absentStudents = attendance?.absent ?? [];
  const hasAttendanceMarks =
    (attendance?.taking_count ?? 0) > 0 || (attendance?.absent_count ?? 0) > 0;

  async function onStartTrip() {
    if (!selectedRouteId) {
      setError("Select a route first");
      return;
    }
    if (!driverProfile?.bus_id) {
      setError("No bus assigned — contact admin");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const started = await startTrip(selectedRouteId);
      setTrip(started);
      alertedMissedIds.current = new Set();
      await loadAttendance(selectedRouteId);
    } catch (e) {
      setError(apiError(e, "Could not start trip"));
    } finally {
      setBusy(false);
    }
  }

  async function onEndTrip() {
    if (!trip) return;
    setBusy(true);
    setError(null);
    try {
      await endTrip(trip.id);
      await stopBackgroundLocation();
      setTrip(null);
      setSpeeding(false);
      setLastSpeed(null);
      setMissedAlerts([]);
      setActiveMissed(null);
      setBgNote(null);
    } catch (e) {
      setError(apiError(e, "Could not end trip"));
    } finally {
      setBusy(false);
    }
  }

  function onSosPress() {
    Alert.alert(
      "Send SOS?",
      "This notifies university admins with your last known location.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send SOS",
          style: "destructive",
          onPress: () => {
            void doSendSos();
          },
        },
      ]
    );
  }

  async function doSendSos() {
    setSosBusy(true);
    setError(null);
    setInfo(null);
    try {
      let lat = driverLat;
      let lng = driverLng;
      if (lat == null || lng == null) {
        try {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
          setDriverLat(lat);
          setDriverLng(lng);
        } catch {
          // send without coords
        }
      }
      await sendSos({ latitude: lat, longitude: lng });
      setInfo("SOS sent to admin. Help is being notified.");
    } catch (e) {
      setError(apiError(e, "Could not send SOS"));
    } finally {
      setSosBusy(false);
    }
  }

  async function onAcknowledgeMissed() {
    if (!activeMissed) return;
    const id = activeMissed.id;
    try {
      await acknowledgeMissedBus(id);
      setMissedAlerts((prev) => prev.filter((a) => a.id !== id));
      setActiveMissed(null);
    } catch (e) {
      // Still dismiss UI; queue ack would be overkill for Phase 4
      setError(apiError(e, "Could not acknowledge alert"));
      setActiveMissed(null);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.ctaIndigoMid} />
      </View>
    );
  }

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
        <Text style={styles.title}>Driver Ops</Text>
        <View style={styles.headerActions}>
          <View
            style={[
              styles.statusPill,
              tripActive ? styles.statusPillLive : styles.statusPillReady,
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                tripActive
                  ? styles.statusPillTextLive
                  : styles.statusPillTextReady,
              ]}
            >
              {tripActive ? "• Live Trip" : "• Ready"}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log out"
            hitSlop={8}
            onPress={logout}
            style={styles.logoutIconBtn}
          >
            <Ionicons
              name="log-out-outline"
              size={20}
              color={colors.muted}
            />
          </Pressable>
        </View>
      </View>

      <Text style={styles.driverName}>{displayName}</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Assigned bus</Text>
        {bus ? (
          <View style={styles.busRow}>
            <View style={styles.busIconBadge}>
              <Ionicons name="bus" size={18} color={colors.onFilled} />
            </View>
            <Text style={styles.cardValue}>
              {bus.bus_number} · {bus.registration} · {bus.capacity} Seats
            </Text>
          </View>
        ) : (
          <Text style={styles.warnText}>
            No bus assigned — ask admin to assign one before starting a trip.
          </Text>
        )}
      </View>

      {speeding ? (
        <View style={styles.speedBanner}>
          <Text style={styles.speedBannerTitle}>⚠ SPEEDING — SLOW DOWN</Text>
          <Text style={styles.speedBannerBody}>
            {lastSpeed != null
              ? `${lastSpeed.toFixed(0)} km/h exceeds ${SPEED_WARN_KMH} km/h limit`
              : `Speed exceeds ${SPEED_WARN_KMH} km/h`}
          </Text>
        </View>
      ) : null}

      {locationDenied && tripActive ? (
        <View style={styles.warnBanner}>
          <Text style={styles.warnText}>
            Location permission denied. Enable location so the bus can be
            tracked.
          </Text>
        </View>
      ) : null}

      {gpsHint && tripActive ? (
        <View style={styles.warnBanner}>
          <Text style={styles.warnText}>{gpsHint}</Text>
        </View>
      ) : null}

      {locationSyncNote && tripActive ? (
        <View style={styles.warnBanner}>
          <Text style={styles.warnText}>{locationSyncNote}</Text>
        </View>
      ) : null}

      {bgNote && tripActive ? (
        <Text style={styles.muted}>{bgNote}</Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}

      {!tripActive ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select route</Text>
          {routes.length === 0 ? (
            <Text style={styles.muted}>No active routes available.</Text>
          ) : (
            routes.map((r) => {
              const selected = r.id === selectedRouteId;
              return (
                <Pressable
                  key={r.id}
                  style={[styles.routeRow, selected && styles.routeRowSelected]}
                  onPress={() => setSelectedRouteId(r.id)}
                >
                  <View style={styles.routeTextCol}>
                    <Text
                      style={[
                        styles.routeName,
                        selected && styles.routeNameSelected,
                      ]}
                    >
                      {r.name}
                    </Text>
                    <Text
                      style={[
                        styles.routeMeta,
                        selected && styles.routeMetaSelected,
                      ]}
                    >
                      {(r.stops?.length ?? 0)} stops
                    </Text>
                  </View>
                  {selected ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={colors.ctaIndigoMid}
                    />
                  ) : (
                    <Ionicons
                      name="ellipse-outline"
                      size={22}
                      color={colors.border}
                    />
                  )}
                </Pressable>
              );
            })
          )}

          {selectedRoute && mapStops.length > 0 ? (
            mapsKeyMissing ? (
              <View style={[styles.mapKeyMissing, { marginTop: 8 }]}>
                <Text style={styles.mapKeyMissingText}>
                  {GOOGLE_MAPS_KEY_MISSING_MESSAGE}
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.mapSectionLabel}>Route stops preview</Text>
                <View style={styles.mapHostPreview} collapsable={false}>
                  <SafeMapView
                    wrapStyle={styles.mapWrapPreview}
                    focusRegion={regionFromPoints(mapStops)}
                    fitCoordinates={mapStops
                      .filter((s) => isValidCoord(s.latitude, s.longitude))
                      .map((s) => ({
                        latitude: s.latitude,
                        longitude: s.longitude,
                      }))}
                    focusKey={previewFocusKey}
                    scrollEnabled
                    zoomEnabled
                    pitchEnabled={false}
                    rotateEnabled={false}
                    moveOnMarkerPress={false}
                    onMapGestureActive={setMapGesturing}
                  >
                    {mapStops
                      .filter((s) => isValidCoord(s.latitude, s.longitude))
                      .map((s) => (
                        <Marker
                          key={`preview-${s.id}`}
                          coordinate={{
                            latitude: s.latitude,
                            longitude: s.longitude,
                          }}
                          title={s.name}
                          pinColor={colors.ctaIndigoMid}
                        />
                      ))}
                  </SafeMapView>
                  {mapStops.every(
                    (s) => !isValidCoord(s.latitude, s.longitude)
                  ) ? (
                    <View style={styles.mapOverlay} pointerEvents="none">
                      <Text style={styles.mapOverlayText}>
                        No valid stop coordinates — showing default region.
                      </Text>
                    </View>
                  ) : null}
                </View>
              </>
            )
          ) : null}

          <Pressable
            style={[styles.startBtn, busy && styles.btnDisabled]}
            onPress={onStartTrip}
            disabled={busy || !selectedRouteId || !driverProfile?.bus_id}
          >
            {busy ? (
              <ActivityIndicator color={colors.onFilled} />
            ) : (
              <View style={styles.btnContent}>
                <Ionicons
                  name="navigate"
                  size={18}
                  color={colors.onFilled}
                />
                <Text style={styles.startBtnText}>Start Trip</Text>
              </View>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trip active</Text>
          <Text style={styles.cardValue}>
            Route: {selectedRoute?.name ?? `#${trip?.route_id}`}
          </Text>
          {lastSpeed != null ? (
            <Text style={styles.muted}>
              Last reported: {lastSpeed.toFixed(0)} km/h
            </Text>
          ) : (
            <Text style={styles.muted}>Uploading GPS every ~7s…</Text>
          )}

          {speeding ? (
            <View style={styles.speedBannerMap}>
              <Text style={styles.speedBannerTitle}>
                ⚠ OVER {SPEED_WARN_KMH} km/h
              </Text>
            </View>
          ) : null}

          {mapsKeyMissing ? (
            <View style={[styles.mapKeyMissing, { marginTop: 10 }]}>
              <Text style={styles.mapKeyMissingText}>
                {GOOGLE_MAPS_KEY_MISSING_MESSAGE}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.mapSectionLabel}>Route stops preview</Text>
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
                  {mapStops
                    .filter((s) => isValidCoord(s.latitude, s.longitude))
                    .map((s) => (
                      <Marker
                        key={`stop-${s.id}`}
                        coordinate={{
                          latitude: s.latitude,
                          longitude: s.longitude,
                        }}
                        title={s.name}
                        description={`Stop ${s.sequence_order}`}
                        pinColor={colors.ctaIndigoMid}
                      />
                    ))}
                  {hasDriverGps ? (
                    <Marker
                      coordinate={{
                        latitude: driverLat!,
                        longitude: driverLng!,
                      }}
                      title="You (bus)"
                      description={
                        lastSpeed != null
                          ? `${lastSpeed.toFixed(0)} km/h`
                          : "Current GPS"
                      }
                      pinColor={colors.success}
                    />
                  ) : null}
                </SafeMapView>
                {mapStops.every((s) => !isValidCoord(s.latitude, s.longitude)) &&
                !hasDriverGps ? (
                  <View style={styles.mapOverlay} pointerEvents="none">
                    <Text style={styles.mapOverlayText}>
                      Waiting for GPS / stop coordinates…
                    </Text>
                  </View>
                ) : !hasDriverGps ? (
                  <View style={styles.mapOverlay} pointerEvents="none">
                    <Text style={styles.mapOverlayText}>
                      Acquiring your GPS position…
                    </Text>
                  </View>
                ) : null}
              </View>
            </>
          )}

          {missedAlerts.length > 0 ? (
            <View style={styles.missedBanner}>
              <Text style={styles.missedBannerTitle}>
                {missedAlerts.length} missed-student alert
                {missedAlerts.length > 1 ? "s" : ""}
              </Text>
              <Text style={styles.missedBannerBody}>
                {missedAlerts
                  .map((a) => {
                    const name =
                      a.student_name || `Student #${a.student_id}`;
                    return a.stop_name ? `${name} @ ${a.stop_name}` : name;
                  })
                  .join(" · ")}
              </Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.sosBtn, sosBusy && styles.btnDisabled]}
            onPress={onSosPress}
            disabled={sosBusy}
          >
            {sosBusy ? (
              <ActivityIndicator color={colors.onFilled} />
            ) : (
              <View style={styles.btnContent}>
                <Ionicons
                  name="warning"
                  size={20}
                  color={colors.onFilled}
                />
                <Text style={styles.sosBtnText}>SOS — EMERGENCY</Text>
              </View>
            )}
          </Pressable>

          <Pressable
            style={[styles.endBtn, busy && styles.btnDisabled]}
            onPress={onEndTrip}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={colors.onFilled} />
            ) : (
              <View style={styles.btnContent}>
                <Ionicons
                  name="stop-circle-outline"
                  size={18}
                  color={colors.onFilled}
                />
                <Text style={styles.endBtnText}>End Trip</Text>
              </View>
            )}
          </Pressable>
        </View>
      )}

      {(tripActive || selectedRouteId) && attendance ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today&apos;s attendance</Text>
          <View style={styles.statRow}>
            <View style={[styles.statCard, styles.statCardTaking]}>
              <Text style={styles.statLabel}>Taking Bus</Text>
              <Text style={[styles.statValue, styles.statValueTaking]}>
                {attendance.taking_count}
              </Text>
            </View>
            <View style={[styles.statCard, styles.statCardAbsent]}>
              <Text style={styles.statLabel}>Absent</Text>
              <Text style={[styles.statValue, styles.statValueAbsent]}>
                {attendance.absent_count}
              </Text>
            </View>
          </View>

          {!hasAttendanceMarks ? (
            <Text style={styles.muted}>
              No students have marked attendance yet for this route.
            </Text>
          ) : (
            <View style={styles.pillGroups}>
              {takingStudents.length > 0 ? (
                <View style={styles.pillGroup}>
                  <Text style={styles.pillGroupLabel}>Taking</Text>
                  <View style={styles.pillWrap}>
                    {takingStudents.map((a) => (
                      <View key={`t-${a.id}`} style={styles.pillTaking}>
                        <Text style={styles.pillTakingText} numberOfLines={1}>
                          {a.student_name || `Student #${a.student_id}`}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              {absentStudents.length > 0 ? (
                <View style={styles.pillGroup}>
                  <Text style={styles.pillGroupLabel}>Absent</Text>
                  <View style={styles.pillWrap}>
                    {absentStudents.map((a) => (
                      <View key={`a-${a.id}`} style={styles.pillAbsent}>
                        <Text style={styles.pillAbsentText} numberOfLines={1}>
                          {a.student_name || `Student #${a.student_id}`}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          )}
        </View>
      ) : null}

      <Modal
        visible={activeMissed != null}
        transparent
        animationType="fade"
        onRequestClose={onAcknowledgeMissed}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Missed student</Text>
            <Text style={styles.modalBody}>
              {(activeMissed?.student_name ||
                `Student #${activeMissed?.student_id}`) +
                (activeMissed?.stop_name
                  ? `\nStop: ${activeMissed.stop_name}`
                  : "") +
                (activeMissed?.message ? `\n${activeMissed.message}` : "")}
            </Text>
            <Pressable
              style={styles.startBtn}
              onPress={onAcknowledgeMissed}
            >
              <Text style={styles.startBtnText}>Acknowledge</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  statusPillReady: {
    backgroundColor: colors.successSoft,
    borderColor: "rgba(34, 197, 94, 0.35)",
  },
  statusPillLive: {
    backgroundColor: colors.successSoft,
    borderColor: "rgba(34, 197, 94, 0.55)",
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  statusPillTextReady: {
    color: colors.success,
  },
  statusPillTextLive: {
    color: colors.accentGreen,
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
  driverName: {
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
  busRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  busIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ctaIndigo,
  },
  cardValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "500",
    flexShrink: 1,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 10,
  },
  routeRow: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  routeRowSelected: {
    borderWidth: 2,
    borderColor: colors.ctaIndigoMid,
    backgroundColor: colors.indigoSoft,
  },
  routeTextCol: {
    flex: 1,
  },
  routeName: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 15,
  },
  routeNameSelected: {
    color: colors.ctaIndigoMid,
  },
  routeMeta: {
    color: colors.muted,
    marginTop: 2,
    fontSize: 13,
  },
  routeMetaSelected: {
    color: colors.brandWordmark,
  },
  mapSectionLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 12,
    marginBottom: 6,
  },
  mapHost: {
    height: 280,
    width: "100%",
    position: "relative",
    marginTop: 0,
    marginBottom: 8,
  },
  mapHostPreview: {
    height: 200,
    width: "100%",
    position: "relative",
    marginTop: 0,
    marginBottom: 4,
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
  mapWrapPreview: {
    height: 200,
    width: "100%",
    borderRadius: radius,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  mapOverlayText: {
    color: colors.onFilled,
    textAlign: "center",
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
    marginBottom: 4,
  },
  mapKeyMissingText: {
    color: colors.warning,
    textAlign: "center",
    lineHeight: 20,
  },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  startBtn: {
    backgroundColor: colors.ctaIndigo,
    borderRadius: radius,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  startBtnText: {
    color: colors.onFilled,
    fontWeight: "700",
    fontSize: 16,
  },
  endBtn: {
    backgroundColor: "#B91C1C",
    borderRadius: radius,
    padding: 14,
    alignItems: "center",
    marginTop: 14,
  },
  endBtnText: {
    color: colors.onFilled,
    fontWeight: "700",
    fontSize: 16,
  },
  sosBtn: {
    backgroundColor: colors.danger,
    borderRadius: radius,
    paddingVertical: 22,
    paddingHorizontal: 14,
    alignItems: "center",
    marginTop: 12,
    borderWidth: 2,
    borderColor: "#F87171",
  },
  sosBtnText: {
    color: colors.onFilled,
    fontWeight: "900",
    fontSize: 18,
    letterSpacing: 1,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  statRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    padding: 14,
  },
  statCardTaking: {
    borderColor: "rgba(34, 197, 94, 0.35)",
    backgroundColor: colors.successSoft,
  },
  statCardAbsent: {
    borderColor: "rgba(245, 158, 11, 0.35)",
    backgroundColor: colors.warningSoft,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  statValue: {
    fontSize: 26,
    fontWeight: "800",
  },
  statValueTaking: {
    color: colors.success,
  },
  statValueAbsent: {
    color: colors.warning,
  },
  pillGroups: {
    gap: 12,
  },
  pillGroup: {
    marginBottom: 4,
  },
  pillGroupLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  pillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pillTaking: {
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.35)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: "100%",
  },
  pillTakingText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: "600",
  },
  pillAbsent: {
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: "100%",
  },
  pillAbsentText: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: "600",
  },
  speedBanner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius,
    padding: 14,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: colors.danger,
  },
  speedBannerMap: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius,
    padding: 10,
    marginTop: 8,
    borderWidth: 2,
    borderColor: colors.danger,
  },
  speedBannerTitle: {
    color: colors.danger,
    fontWeight: "800",
    fontSize: 16,
    marginBottom: 4,
    textAlign: "center",
  },
  speedBannerBody: {
    color: colors.danger,
    textAlign: "center",
  },
  missedBanner: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  missedBannerTitle: {
    color: colors.warning,
    fontWeight: "800",
    marginBottom: 4,
  },
  missedBannerBody: {
    color: colors.warning,
  },
  warnBanner: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius,
    padding: 12,
    marginBottom: 12,
  },
  warnText: {
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.modalScrim,
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.warning,
  },
  modalTitle: {
    color: colors.warning,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 10,
  },
  modalBody: {
    color: colors.text,
    lineHeight: 22,
    marginBottom: 8,
  },
});
