import { api } from "./client";
import type { Complaint } from "../types";

export async function submitComplaint(payload: {
  subject: string;
  body: string;
  trip_id?: number | null;
  driver_id?: number | null;
}): Promise<Complaint> {
  const { data } = await api.post<{ complaint: Complaint }>(
    "/api/complaints",
    payload
  );
  return data.complaint;
}
