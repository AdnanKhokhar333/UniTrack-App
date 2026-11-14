import { io, type Socket } from "socket.io-client";

/** Live location payload from server ``trip_location`` event. */
export type TripLocationEvent = {
  trip_id: number;
  route_id: number;
  bus_id: number;
  latitude: number;
  longitude: number;
  speed_kmh: number | null;
  recorded_at: string | null;
};

/**
 * Socket.IO base URL: same origin when VITE_API_URL is empty (Vite proxies
 * `/socket.io` → Flask). Otherwise connect directly to the API host.
 */
export function socketBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return window.location.origin;
}

export function createLiveSocket(token: string): Socket {
  return io(socketBaseUrl(), {
    auth: { token },
    transports: ["websocket", "polling"],
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 2000,
  });
}
