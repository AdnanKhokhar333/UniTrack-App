import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { postTripLocation } from "../api/trips";
import { enqueueLocation } from "./locationQueue";

export const BACKGROUND_LOCATION_TASK = "unitrack-background-location";
const ACTIVE_TRIP_KEY = "unitrack_bg_trip_id";

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    return;
  }
  const tripIdRaw = await AsyncStorage.getItem(ACTIVE_TRIP_KEY);
  if (!tripIdRaw) return;
  const tripId = Number(tripIdRaw);
  if (!tripId) return;

  const locations = (data as { locations?: Location.LocationObject[] })
    ?.locations;
  if (!locations?.length) return;

  const pos = locations[locations.length - 1];
  const rawMs = pos.coords.speed;
  const speedKmh = rawMs != null && rawMs >= 0 ? rawMs * 3.6 : 0;
  const payload = {
    tripId,
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    speed_kmh: speedKmh,
    queued_at: new Date().toISOString(),
  };

  try {
    await postTripLocation(tripId, {
      latitude: payload.latitude,
      longitude: payload.longitude,
      speed_kmh: payload.speed_kmh,
    });
  } catch {
    await enqueueLocation(payload);
  }
});

export async function setBackgroundTripId(tripId: number | null) {
  if (tripId == null) {
    await AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
  } else {
    await AsyncStorage.setItem(ACTIVE_TRIP_KEY, String(tripId));
  }
}

/**
 * Best-effort background GPS while trip is active.
 * Fully-killed app tracking is limited on Expo Go; a dev/prod build
 * with background location permission works better on Android.
 */
export async function startBackgroundLocation(): Promise<{
  ok: boolean;
  reason?: string;
}> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") {
    return { ok: false, reason: "foreground_denied" };
  }

  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") {
    // Foreground-only still works; document limitation
    return { ok: false, reason: "background_denied" };
  }

  const started = await Location.hasStartedLocationUpdatesAsync(
    BACKGROUND_LOCATION_TASK
  );
  if (started) {
    return { ok: true };
  }

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 7000,
    distanceInterval: 15,
    deferredUpdatesInterval: 7000,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "UniTrack trip active",
      notificationBody: "Sharing bus location with students.",
      notificationColor: "#0f172a",
    },
    pausesUpdatesAutomatically: false,
  });
  return { ok: true };
}

export async function stopBackgroundLocation(): Promise<void> {
  await setBackgroundTripId(null);
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK
    );
    if (started) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch {
    // Task may not be registered yet
  }
}
