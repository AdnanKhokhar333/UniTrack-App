import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

/**
 * API base URL resolution:
 * - Prefer EXPO_PUBLIC_API_URL (set in .env)
 * - Fall back to app.json `extra.apiUrl`
 * - Default localhost (Android emulator / iOS simulator only)
 *
 * Physical device: use your machine's LAN IP, e.g.
 *   EXPO_PUBLIC_API_URL=http://192.168.1.42:5000
 * Emulator: localhost (Android may need http://10.0.2.2:5000)
 */
const apiUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ||
  "http://192.168.100.8:5000";

export const API_BASE_URL = apiUrl;

export const api = axios.create({
  baseURL: apiUrl,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("unitrack_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
