import { api } from "./client";
import type { BusPass } from "../types";

export async function getMyBusPass(): Promise<BusPass> {
  const { data } = await api.get<{ pass: BusPass }>("/api/students/me/pass");
  return data.pass;
}
