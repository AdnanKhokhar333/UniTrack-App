import AsyncStorage from "@react-native-async-storage/async-storage";
import { postTripLocation } from "../api/trips";

const QUEUE_KEY = "unitrack_location_queue";

export type QueuedLocation = {
  tripId: number;
  latitude: number;
  longitude: number;
  speed_kmh: number;
  queued_at: string;
};

export async function enqueueLocation(
  point: QueuedLocation
): Promise<void> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  const list: QueuedLocation[] = raw ? JSON.parse(raw) : [];
  list.push(point);
  // Cap queue to avoid unbounded growth offline
  const trimmed = list.slice(-200);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
}

export async function flushLocationQueue(): Promise<number> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return 0;
  const list: QueuedLocation[] = JSON.parse(raw);
  if (list.length === 0) return 0;

  const remaining: QueuedLocation[] = [];
  let flushed = 0;
  for (let i = 0; i < list.length; i++) {
    const point = list[i];
    try {
      await postTripLocation(point.tripId, {
        latitude: point.latitude,
        longitude: point.longitude,
        speed_kmh: point.speed_kmh,
      });
      flushed += 1;
    } catch {
      remaining.push(...list.slice(i));
      break;
    }
  }
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return flushed;
}
