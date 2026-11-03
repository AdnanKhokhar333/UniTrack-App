import { api } from "./client";
import type { LocationPostResult, Trip } from "../types";

export async function startTrip(routeId: number): Promise<Trip> {
  const { data } = await api.post<{ trip: Trip }>("/api/trips/start", {
    route_id: routeId,
  });
  return data.trip;
}

export async function endTrip(tripId: number): Promise<Trip> {
  const { data } = await api.post<{ trip: Trip }>(`/api/trips/${tripId}/end`);
  return data.trip;
}

export async function postTripLocation(
  tripId: number,
  payload: {
    latitude: number;
    longitude: number;
    speed_kmh?: number;
  }
): Promise<LocationPostResult> {
  const { data } = await api.post<LocationPostResult>(
    `/api/trips/${tripId}/location`,
    payload
  );
  return data;
}

export async function getMyActiveTrip(): Promise<Trip | null> {
  const { data } = await api.get<{ trip: Trip | null }>(
    "/api/trips/mine/active"
  );
  return data.trip;
}

export async function listActiveTrips(): Promise<Trip[]> {
  const { data } = await api.get<{ trips: Trip[] }>("/api/trips/active");
  return data.trips;
}

export async function getTrip(tripId: number): Promise<Trip> {
  const { data } = await api.get<{ trip: Trip }>(`/api/trips/${tripId}`);
  return data.trip;
}
