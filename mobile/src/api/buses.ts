import { api } from "./client";
import type { Bus } from "../types";

export async function listBuses(): Promise<Bus[]> {
  const { data } = await api.get<{ buses: Bus[] }>("/api/buses");
  return data.buses;
}

export async function getBus(busId: number): Promise<Bus> {
  const { data } = await api.get<{ bus: Bus }>(`/api/buses/${busId}`);
  return data.bus;
}
