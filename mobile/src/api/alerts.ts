import { api } from "./client";
import type { MissedBusAlert, SosAlert } from "../types";

export async function reportMissedBus(
  message?: string
): Promise<MissedBusAlert> {
  const { data } = await api.post<{ alert: MissedBusAlert }>(
    "/api/alerts/missed-bus",
    message ? { message } : {}
  );
  return data.alert;
}

export async function listActiveMissedBusAlerts(): Promise<MissedBusAlert[]> {
  const { data } = await api.get<{ alerts: MissedBusAlert[] }>(
    "/api/alerts/missed-bus/active"
  );
  return data.alerts;
}

export async function acknowledgeMissedBus(
  alertId: number
): Promise<MissedBusAlert> {
  const { data } = await api.patch<{ alert: MissedBusAlert }>(
    `/api/alerts/missed-bus/${alertId}/acknowledge`
  );
  return data.alert;
}

export async function sendSos(payload: {
  latitude?: number | null;
  longitude?: number | null;
}): Promise<SosAlert> {
  const body: { latitude?: number; longitude?: number } = {};
  if (payload.latitude != null && payload.longitude != null) {
    body.latitude = payload.latitude;
    body.longitude = payload.longitude;
  }
  const { data } = await api.post<{ alert: SosAlert }>("/api/alerts/sos", body);
  return data.alert;
}
