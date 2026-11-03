import { api } from "./client";
import type { Route, Stop, StopInput } from "./types";

export async function listRoutes(): Promise<Route[]> {
  const { data } = await api.get<{ routes: Route[] }>("/api/routes");
  return data.routes;
}

export async function createRoute(payload: {
  name: string;
  description?: string;
  is_active?: boolean;
  stops?: StopInput[];
}): Promise<Route> {
  const { data } = await api.post<{ route: Route }>("/api/routes", payload);
  return data.route;
}

export async function updateRoute(
  routeId: number,
  payload: Partial<{
    name: string;
    description: string | null;
    is_active: boolean;
    stops: StopInput[];
  }>
): Promise<Route> {
  const { data } = await api.put<{ route: Route }>(
    `/api/routes/${routeId}`,
    payload
  );
  return data.route;
}

export async function addStop(
  routeId: number,
  payload: StopInput
): Promise<Stop> {
  const { data } = await api.post<{ stop: Stop }>(
    `/api/routes/${routeId}/stops`,
    payload
  );
  return data.stop;
}
