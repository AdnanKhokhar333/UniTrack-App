import { api } from "./client";
import type { AttendanceSummary } from "./types";

export async function getAttendanceSummary(): Promise<AttendanceSummary> {
  const { data } = await api.get<AttendanceSummary>("/api/attendance/summary");
  return data;
}
