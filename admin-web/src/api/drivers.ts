import { api } from "./client";
import type { Driver } from "./types";

export async function listDrivers(): Promise<Driver[]> {
  const { data } = await api.get<{ drivers: Driver[] }>("/api/users/drivers");
  return data.drivers;
}

export async function createDriver(payload: {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  license_number?: string;
  bus_id?: number | null;
}): Promise<Driver> {
  const { data } = await api.post<{ driver_profile: Driver }>(
    "/api/users/drivers",
    payload
  );
  return data.driver_profile;
}

export async function updateDriver(
  driverProfileId: number,
  payload: Partial<{
    full_name: string;
    phone: string | null;
    license_number: string | null;
    bus_id: number | null;
    password: string;
  }>
): Promise<Driver> {
  const { data } = await api.patch<{ driver_profile: Driver }>(
    `/api/users/drivers/${driverProfileId}`,
    payload
  );
  return data.driver_profile;
}

export async function deleteDriver(driverProfileId: number): Promise<Driver> {
  const { data } = await api.delete<{
    message: string;
    driver_profile: Driver;
  }>(`/api/users/drivers/${driverProfileId}`);
  return data.driver_profile;
}
