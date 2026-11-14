import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "./client";

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

export function createLiveSocket(token: string): Socket {
  return io(API_BASE_URL.replace(/\/$/, ""), {
    auth: { token },
    transports: ["websocket", "polling"],
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 2000,
  });
}
