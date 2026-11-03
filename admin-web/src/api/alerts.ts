import { api } from "./client";
import type { SosAlert, SpeedingLog } from "./types";

export async function listSosAlerts(
  status?: "open" | "resolved"
): Promise<SosAlert[]> {
  const { data } = await api.get<{ alerts: SosAlert[] }>("/api/alerts/sos", {
    params: status ? { status } : undefined,
  });
  return data.alerts;
}

export async function resolveSosAlert(alertId: number): Promise<SosAlert> {
  const { data } = await api.patch<{ alert: SosAlert }>(
    `/api/alerts/sos/${alertId}/resolve`
  );
  return data.alert;
}

export async function listSpeedingLogs(): Promise<SpeedingLog[]> {
  const { data } = await api.get<{ logs: SpeedingLog[] }>(
    "/api/alerts/speeding"
  );
  return data.logs;
}
