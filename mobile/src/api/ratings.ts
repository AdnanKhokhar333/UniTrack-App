import { api } from "./client";
import type { DriverRating } from "../types";

export async function submitRating(payload: {
  stars: number;
  comment?: string;
  trip_id?: number | null;
  driver_id?: number | null;
}): Promise<DriverRating> {
  const { data } = await api.post<{ rating: DriverRating }>(
    "/api/ratings",
    payload
  );
  return data.rating;
}
