import { api } from "./client";
import type { DriverAverage, DriverRating } from "./types";

export async function listRatings(driverId?: number): Promise<{
  ratings: DriverRating[];
  averages: DriverAverage[];
}> {
  const { data } = await api.get<{
    ratings: DriverRating[];
    averages: DriverAverage[];
  }>("/api/ratings", {
    params: driverId != null ? { driver_id: driverId } : undefined,
  });
  return data;
}
