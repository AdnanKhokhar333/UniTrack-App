import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const DEFAULT_API_URL = "http://192.168.100.19:5000";
const API_PORT = 5000;

/**
 * Derive API base URL from Expo's packager host (LAN IP), port 5000.
 * Tracks Wi-Fi IP changes whenever Expo/Metro reconnects.
 */
export function deriveApiUrlFromExpoHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } })
      .manifest2?.extra?.expoClient?.hostUri ||
    (
      Constants as {
        manifest?: { debuggerHost?: string; hostUri?: string };
      }
    ).manifest?.debuggerHost ||
    (
      Constants as {
        manifest?: { debuggerHost?: string; hostUri?: string };
      }
    ).manifest?.hostUri ||
    null;

  if (!hostUri || typeof hostUri !== "string") return null;

  const host = hostUri.split(":")[0]?.trim();
  if (!host || host === "localhost" || host === "127.0.0.1") return null;

  return `http://${host}:${API_PORT}`;
}

function configuredApiUrl(): string {
  return (
    process.env.EXPO_PUBLIC_API_URL ||
    (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ||
    DEFAULT_API_URL
  );
}

/**
 * Resolve API base URL:
 * - Expo Go: prefer host derived from Constants.expoConfig.hostUri (port 5000)
 * - Otherwise: EXPO_PUBLIC_API_URL / app config / default LAN IP
 * - Fall back to Expo host when available
 */
function resolveApiBaseUrl(): string {
  const configured = configuredApiUrl();
  const fromExpo = deriveApiUrlFromExpoHost();
  const isExpoGo = Constants.appOwnership === "expo";

  if (isExpoGo && fromExpo) {
    return fromExpo;
  }

  return configured || fromExpo || DEFAULT_API_URL;
}

let apiUrl = resolveApiBaseUrl();

export let API_BASE_URL = apiUrl;

/** Switch the shared axios client to another base URL (e.g. Expo host fallback). */
export function setApiBaseUrl(url: string): void {
  const next = url.replace(/\/$/, "");
  if (!next || next === api.defaults.baseURL) return;
  apiUrl = next;
  API_BASE_URL = next;
  api.defaults.baseURL = next;
}

/**
 * Alternate base URL when the current one fails (configured ↔ Expo host).
 */
export function getAlternateApiBaseUrl(): string | null {
  const current = (api.defaults.baseURL || API_BASE_URL).replace(/\/$/, "");
  const configured = configuredApiUrl().replace(/\/$/, "");
  const fromExpo = deriveApiUrlFromExpoHost()?.replace(/\/$/, "") ?? null;

  if (fromExpo && fromExpo !== current) return fromExpo;
  if (configured && configured !== current) return configured;
  if (DEFAULT_API_URL !== current) return DEFAULT_API_URL;
  return null;
}

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
