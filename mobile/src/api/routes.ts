import { api } from "./client";
import type { Route } from "../types";

export async function listRoutes(): Promise<Route[]> {
  const { data } = await api.get<{ routes: Route[] }>("/api/routes");
  return data.routes;
}

export async function getRoute(routeId: number): Promise<Route> {
  const { data } = await api.get<{ route: Route }>(`/api/routes/${routeId}`);
  return data.route;
}
