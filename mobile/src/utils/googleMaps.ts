import { useEffect, useState } from "react";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { PROVIDER_GOOGLE } from "react-native-maps";

const MISSING_KEY_HINTS = new Set([
  "",
  "YOUR_GOOGLE_MAPS_API_KEY_HERE",
  "your_key_here",
]);

/** True when running inside Expo Go (not a custom/dev/standalone build). */
export function isExpoGo(): boolean {
  return Constants.appOwnership === "expo";
}

/**
 * Google Maps API key from Expo config `extra` (wired in app.config.js)
 * or EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.
 */
export function getGoogleMapsApiKey(): string {
  const fromExtra = (
    Constants.expoConfig?.extra as { googleMapsApiKey?: string } | undefined
  )?.googleMapsApiKey;
  const fromEnv = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  return String(fromExtra || fromEnv || "").trim();
}

/**
 * Expo Go: omit provider (undefined) so RN Maps uses the platform default
 * baked into Expo Go — PROVIDER_DEFAULT/"google" often sticks on Android.
 * Dev/standalone with a real key → PROVIDER_GOOGLE.
 */
export function getMapProvider(): typeof PROVIDER_GOOGLE | undefined {
  if (Platform.OS === "web" || isExpoGo()) {
    return undefined;
  }
  if (!MISSING_KEY_HINTS.has(getGoogleMapsApiKey())) {
    return PROVIDER_GOOGLE;
  }
  return undefined;
}

/**
 * Only warn when a custom/standalone native build needs your Google key.
 * Expo Go and web do not require EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.
 */
export function isGoogleMapsApiKeyMissing(): boolean {
  if (Platform.OS === "web" || isExpoGo()) return false;
  return MISSING_KEY_HINTS.has(getGoogleMapsApiKey());
}

export const GOOGLE_MAPS_KEY_MISSING_MESSAGE =
  "Google Maps API key missing — set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in mobile/.env and restart with npx expo start -c";

export const MAP_LOAD_FAILED_MESSAGE =
  "Map failed to load in Expo Go — try reload, or use npx expo run:android with EXPO_PUBLIC_GOOGLE_MAPS_API_KEY for reliable tiles.";

/** Track onMapReady + timed fallback so loading never spins forever. */
export function useMapReadyGate(timeoutMs = 4000) {
  const [mapReady, setMapReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (mapReady) {
      setTimedOut(false);
      return;
    }
    setTimedOut(false);
    const id = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(id);
  }, [mapReady, timeoutMs]);

  return {
    mapReady,
    showLoadFailed: timedOut && !mapReady,
    onMapReady: () => setMapReady(true),
    resetMapReady: () => {
      setMapReady(false);
      setTimedOut(false);
    },
  };
}
