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
