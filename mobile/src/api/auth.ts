import axios from "axios";
import {
  api,
  getAlternateApiBaseUrl,
  setApiBaseUrl,
} from "./client";
import type { LoginResponse, MeResponse } from "../types";

const USER_FRIENDLY_NETWORK_ERROR =
  "Unable to connect to the UniTrack server. Please check your Wi-Fi connection and try again.";

function unreachableApiError(): Error {
  return new Error(USER_FRIENDLY_NETWORK_ERROR);
}

function isNetworkFailure(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  if (error.response) return false;
  const code = error.code;
  const message = (error.message || "").toLowerCase();
  return (
    code === "ERR_NETWORK" ||
    code === "ECONNABORTED" ||
    code === "ETIMEDOUT" ||
    message.includes("network error") ||
    message.includes("timeout")
  );
}

export async function loginRequest(
  email: string,
  password: string
): Promise<LoginResponse> {
  const body = { email, password };

  try {
    const { data } = await api.post<LoginResponse>("/api/auth/login", body);
    return data;
  } catch (error) {
    if (!isNetworkFailure(error)) {
      throw error;
    }

    // Configured URL unreachable — retry once via Expo hostUri-derived LAN IP
    const alternate = getAlternateApiBaseUrl();
    if (alternate) {
      setApiBaseUrl(alternate);
      try {
        const { data } = await api.post<LoginResponse>("/api/auth/login", body);
        return data;
      } catch (retryError) {
        if (isNetworkFailure(retryError)) {
          throw unreachableApiError();
        }
        throw retryError;
      }
    }

    throw unreachableApiError();
  }
}

export async function fetchMe(): Promise<MeResponse> {
  const { data } = await api.get<MeResponse>("/api/auth/me");
  return data;
}
