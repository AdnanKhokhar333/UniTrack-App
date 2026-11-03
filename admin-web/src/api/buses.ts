import { api } from "./client";
import type { Bus } from "./types";

export async function listBuses(): Promise<Bus[]> {
  const { data } = await api.get<{ buses: Bus[] }>("/api/buses");
  return data.buses;
}

export async function createBus(payload: {
  bus_number: string;
  registration: string;
  capacity?: number;
  is_active?: boolean;
}): Promise<Bus> {
  const { data } = await api.post<{ bus: Bus }>("/api/buses", payload);
  return data.bus;
}

export async function updateBus(
  busId: number,
  payload: Partial<{
    bus_number: string;
    registration: string;
    capacity: number;
    is_active: boolean;
  }>
): Promise<Bus> {
  const { data } = await api.put<{ bus: Bus }>(`/api/buses/${busId}`, payload);
  return data.bus;
}
