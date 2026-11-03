/** Shared API types — field names match backend model to_dict() payloads. */

export type UserRole = "admin" | "driver" | "student";

export type AuthUser = {
  id: number;
  university_id: number;
  email: string;
  role: UserRole;
  is_approved: boolean;
  is_active: boolean;
  created_at?: string | null;
};

export type DriverProfile = {
  id: number;
  user_id: number;
  bus_id: number | null;
  full_name: string;
  phone: string | null;
  license_number: string | null;
  email?: string | null;
};

export type StudentProfile = {
  id: number;
  user_id: number;
  student_number: string;
  full_name: string;
  phone: string | null;
  active_route_id: number | null;
  stop_id: number | null;
  email?: string | null;
  is_approved?: boolean;
};

export type Bus = {
  id: number;
  university_id: number;
  bus_number: string;
  registration: string;
  capacity: number;
  is_active: boolean;
};

export type Stop = {
  id: number;
  route_id: number;
  name: string;
  latitude: number;
  longitude: number;
  sequence_order: number;
};

export type Route = {
  id: number;
  university_id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  stops?: Stop[];
};

export type AttendanceStatus = "taking" | "absent";

export type Attendance = {
  id: number;
  student_id: number;
  route_id: number;
  attendance_date: string;
  status: AttendanceStatus;
  student_name?: string | null;
  stop_id?: number | null;
};

export type AttendanceByStop = {
  stop_id: number | null;
  taking: Attendance[];
  absent: Attendance[];
  taking_count: number;
  absent_count: number;
};

export type RouteAttendanceSummary = {
  route_id: number;
  date: string;
  taking_count: number;
  absent_count: number;
  taking: Attendance[];
  absent: Attendance[];
  by_stop: AttendanceByStop[];
};

export type TripStatus = "active" | "completed" | "cancelled";

export type TripLocation = {
  id: number;
  trip_id: number;
  latitude: number;
  longitude: number;
  speed_kmh: number | null;
  recorded_at: string | null;
};

export type Trip = {
  id: number;
  bus_id: number;
  driver_id: number;
  route_id: number;
  status: TripStatus;
  started_at: string | null;
  ended_at: string | null;
  latest_location?: TripLocation | null;
};

export type LocationPostResult = {
  location: TripLocation;
  speeding: boolean;
  threshold_kmh: number;
};

export type LoginResponse = {
  access_token: string;
  user: AuthUser;
  driver_profile?: DriverProfile;
  student_profile?: StudentProfile;
};

export type MeResponse = {
  user: AuthUser;
  driver_profile?: DriverProfile;
  student_profile?: StudentProfile;
};

export type MissedBusAlert = {
  id: number;
  student_id: number;
  trip_id: number | null;
  route_id: number;
  stop_id: number | null;
  message: string | null;
  acknowledged: boolean;
  created_at: string | null;
  student_name?: string | null;
  stop_name?: string | null;
};

export type SosStatus = "open" | "resolved";

export type SosAlert = {
  id: number;
  driver_id: number;
  trip_id: number | null;
  latitude: number | null;
  longitude: number | null;
  status: SosStatus;
  created_at: string | null;
  resolved_at: string | null;
  driver_name?: string | null;
};

export type DeviceToken = {
  id: number;
  user_id: number;
  token: string;
  platform: string | null;
  updated_at: string | null;
  created_at: string | null;
};
