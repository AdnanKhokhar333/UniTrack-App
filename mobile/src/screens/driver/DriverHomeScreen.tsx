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

  // Foreground GPS + offline queue while trip is active
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
        <ActivityIndicator size="large" color="#38bdf8" />
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
      <Text style={styles.title}>Driver Mode</Text>
      <Text style={styles.muted}>
        {driverProfile?.full_name || user?.email}
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Assigned bus</Text>
        {bus ? (
          <Text style={styles.cardValue}>
            {bus.bus_number} · {bus.registration} · cap {bus.capacity}
          </Text>
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
                  <Text
                    style={[
                      styles.routeName,
                      selected && styles.routeNameSelected,
                    ]}
                  >
                    {r.name}
                  </Text>
                  <Text style={styles.routeMeta}>
                    {(r.stops?.length ?? 0)} stops
                  </Text>
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
                        pinColor="#94a3b8"
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
            )
          ) : null}

          <Pressable
            style={[styles.primaryBtn, busy && styles.btnDisabled]}
            onPress={onStartTrip}
            disabled={busy || !selectedRouteId || !driverProfile?.bus_id}
          >
            {busy ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <Text style={styles.primaryBtnText}>Start Trip</Text>
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
                      pinColor="#94a3b8"
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
                    pinColor="#22c55e"
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
              <ActivityIndicator color="#f8fafc" />
            ) : (
              <Text style={styles.sosBtnText}>SOS — EMERGENCY</Text>
            )}
          </Pressable>

          <Pressable
            style={[styles.dangerBtn, busy && styles.btnDisabled]}
            onPress={onEndTrip}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#f8fafc" />
            ) : (
              <Text style={styles.dangerBtnText}>End Trip</Text>
            )}
          </Pressable>
        </View>
      )}

      {(tripActive || selectedRouteId) && attendance ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today&apos;s attendance</Text>
          <Text style={styles.muted}>
            Taking {attendance.taking_count} · Absent {attendance.absent_count}
          </Text>
          {attendance.by_stop.length === 0 ? (
            <Text style={styles.muted}>
              No students have marked attendance yet for this route.
            </Text>
          ) : (
            attendance.by_stop.map((bucket) => {
              const stopName =
                selectedRoute?.stops?.find((s) => s.id === bucket.stop_id)
                  ?.name ||
                (bucket.stop_id != null
                  ? `Stop #${bucket.stop_id}`
                  : "Unassigned stop");
              return (
                <View key={String(bucket.stop_id)} style={styles.stopBlock}>
                  <Text style={styles.stopTitle}>
                    {stopName}{" "}
                    <Text style={styles.muted}>
                      ({bucket.taking_count} taking / {bucket.absent_count}{" "}
                      absent)
                    </Text>
                  </Text>
                  {bucket.taking.map((a) => (
                    <Text key={`t-${a.id}`} style={styles.takingName}>
                      · {a.student_name || `Student #${a.student_id}`}
                    </Text>
                  ))}
                  {bucket.absent.map((a) => (
                    <Text key={`a-${a.id}`} style={styles.absentName}>
                      · {a.student_name || `Student #${a.student_id}`} (absent)
                    </Text>
                  ))}
                </View>
              );
            })
          )}
        </View>
      ) : null}

      <Pressable style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>

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
              style={styles.primaryBtn}
              onPress={onAcknowledgeMissed}
            >
              <Text style={styles.primaryBtnText}>Acknowledge</Text>
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
    fontSize: 16,
    fontWeight: "500",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: "#f8fafc",
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 10,
  },
  routeRow: {
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  routeRowSelected: {
    borderColor: "#38bdf8",
  },
  routeName: {
    color: "#e2e8f0",
    fontWeight: "600",
    fontSize: 15,
  },
  routeNameSelected: {
    color: "#38bdf8",
  },
  routeMeta: {
    color: "#64748b",
    marginTop: 2,
    fontSize: 13,
  },
  mapHost: {
    height: 280,
    width: "100%",
    position: "relative",
    marginTop: 10,
    marginBottom: 8,
  },
  mapHostPreview: {
    height: 200,
    width: "100%",
    position: "relative",
    marginTop: 8,
    marginBottom: 4,
  },
  mapWrap: {
    height: 280,
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1e293b",
  },
  mapWrapPreview: {
    height: 200,
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1e293b",
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
  mapKeyMissing: {
    minHeight: 120,
    width: "100%",
    borderRadius: 12,
    backgroundColor: "#422006",
    borderWidth: 1,
    borderColor: "#fbbf24",
    padding: 16,
    justifyContent: "center",
    marginBottom: 4,
  },
  mapKeyMissingText: {
    color: "#fde68a",
    textAlign: "center",
    lineHeight: 20,
  },
  primaryBtn: {
    backgroundColor: "#38bdf8",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  primaryBtnText: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 16,
  },
  dangerBtn: {
    backgroundColor: "#dc2626",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 14,
  },
  dangerBtnText: {
    color: "#f8fafc",
    fontWeight: "700",
    fontSize: 16,
  },
  sosBtn: {
    backgroundColor: "#991b1b",
    borderRadius: 12,
    paddingVertical: 22,
    paddingHorizontal: 14,
    alignItems: "center",
    marginTop: 12,
    borderWidth: 2,
    borderColor: "#f87171",
  },
  sosBtnText: {
    color: "#fef2f2",
    fontWeight: "900",
    fontSize: 18,
    letterSpacing: 1,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  speedBanner: {
    backgroundColor: "#7f1d1d",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#ef4444",
  },
  speedBannerMap: {
    backgroundColor: "#7f1d1d",
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderWidth: 2,
    borderColor: "#ef4444",
  },
  speedBannerTitle: {
    color: "#fecaca",
    fontWeight: "800",
    fontSize: 16,
    marginBottom: 4,
    textAlign: "center",
  },
  speedBannerBody: {
    color: "#fee2e2",
    textAlign: "center",
  },
  missedBanner: {
    backgroundColor: "#7c2d12",
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#fb923c",
  },
  missedBannerTitle: {
    color: "#fed7aa",
    fontWeight: "800",
    marginBottom: 4,
  },
  missedBannerBody: {
    color: "#ffedd5",
  },
  warnBanner: {
    backgroundColor: "#422006",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  warnText: {
    color: "#fbbf24",
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
  stopBlock: {
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  stopTitle: {
    color: "#f8fafc",
    fontWeight: "600",
    marginBottom: 6,
  },
  takingName: {
    color: "#86efac",
    marginBottom: 2,
  },
  absentName: {
    color: "#94a3b8",
    marginBottom: 2,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#1e293b",
    borderRadius: 14,
    padding: 20,
    borderWidth: 2,
    borderColor: "#fb923c",
  },
  modalTitle: {
    color: "#fdba74",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 10,
  },
  modalBody: {
    color: "#e2e8f0",
    lineHeight: 22,
    marginBottom: 8,
  },
});
