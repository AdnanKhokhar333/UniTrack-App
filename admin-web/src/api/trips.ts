import { api } from "./client";
import type { Trip } from "./types";

export async function listActiveTrips(): Promise<Trip[]> {
  const { data } = await api.get<{ trips: Trip[] }>("/api/trips/active");
  return data.trips;
}
