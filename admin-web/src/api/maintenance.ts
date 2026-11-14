import { api } from "./client";
import type { BusMaintenanceBundle, BusMaintenanceLog } from "./types";

export async function listBusMaintenance(): Promise<{
  buses: BusMaintenanceBundle[];
  formula: string;
}> {
  const { data } = await api.get<{
    buses: BusMaintenanceBundle[];
    formula: string;
  }>("/api/maintenance/buses");
  return data;
}

export async function createMaintenanceLog(payload: {
  bus_id: number;
  note: string;
  liters_added?: number | null;
}): Promise<BusMaintenanceLog> {
  const { data } = await api.post<{ log: BusMaintenanceLog }>(
    "/api/maintenance/logs",
    payload
  );
  return data.log;
}
