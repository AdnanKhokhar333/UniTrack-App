import { api } from "./client";
import type {
  Attendance,
  AttendanceStatus,
  RouteAttendanceSummary,
} from "../types";

export async function getTodayAttendance(): Promise<Attendance | null> {
  const { data } = await api.get<{ attendance: Attendance | null }>(
    "/api/attendance/today"
  );
  return data.attendance;
}

export async function submitAttendance(
  status: AttendanceStatus
): Promise<Attendance> {
  const { data } = await api.post<{ attendance: Attendance }>(
    "/api/attendance",
    { status }
  );
  return data.attendance;
}

export async function getRouteAttendance(
  routeId: number
): Promise<RouteAttendanceSummary> {
  const { data } = await api.get<RouteAttendanceSummary>(
    `/api/attendance/route/${routeId}`
  );
  return data;
}
