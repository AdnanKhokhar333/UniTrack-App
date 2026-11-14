export type Bus = {
  id: number;
  university_id: number;
  bus_number: string;
  registration: string;
  capacity: number;
  is_active: boolean;
};

export type Driver = {
  id: number;
  user_id: number;
  bus_id: number | null;
  full_name: string;
  phone: string | null;
  license_number: string | null;
  email: string | null;
  is_active?: boolean;
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

export type Student = {
  id: number;
  user_id: number;
  student_number: string;
  full_name: string;
  phone: string | null;
  active_route_id: number | null;
  stop_id: number | null;
  email: string | null;
  is_approved: boolean;
  is_active?: boolean;
};

export type StopInput = {
  name: string;
  latitude: number;
  longitude: number;
  sequence_order: number;
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

export type SpeedingLog = {
  id: number;
  trip_id: number;
  driver_id: number;
  latitude: number;
  longitude: number;
  speed_kmh: number;
  threshold_kmh: number;
  recorded_at: string | null;
};

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
  status: "active" | "completed" | "cancelled";
  started_at: string | null;
  ended_at: string | null;
  latest_location?: TripLocation | null;
};

export type DriverRating = {
  id: number;
  student_id: number;
  driver_id: number;
  trip_id: number | null;
  stars: number;
  comment: string | null;
  created_at: string | null;
};

export type DriverAverage = {
  driver_id: number;
  driver_name: string | null;
  avg_stars: number;
  count: number;
};

export type Complaint = {
  id: number;
  student_id: number;
  driver_id: number | null;
  trip_id: number | null;
  subject: string;
  body: string;
  is_resolved: boolean;
  created_at: string | null;
};

export type AttendanceSummary = {
  date: string;
  taking_count: number;
  absent_count: number;
  total_marked: number;
};

export type BusMaintenanceLog = {
  id: number;
  bus_id: number;
  note: string;
  liters_added: number | null;
  created_by_user_id: number | null;
  created_at: string | null;
};

export type BusFuelEstimate = {
  distance_km: number;
  estimated_liters: number | null;
  trip_count: number;
  completed_trips: number;
  km_per_liter: number;
};

export type BusMaintenanceBundle = {
  bus: Bus;
  fuel: BusFuelEstimate;
  liters_logged: number;
  recent_logs: BusMaintenanceLog[];
};

export type BulkStudentResult = {
  created: number;
  failed: number;
  success: Array<{
    row: number;
    user: { id: number; email: string };
    student_profile: Student;
  }>;
  errors: Array<{
    row: number;
    error: string;
    email?: string | null;
    student_number?: string | null;
  }>;
};
