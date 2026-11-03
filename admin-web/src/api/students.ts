import { api } from "./client";
import type { Student } from "./types";

export async function listStudents(): Promise<Student[]> {
  const { data } = await api.get<{ students: Student[] }>("/api/users/students");
  return data.students;
}

export async function createStudent(payload: {
  email: string;
  password: string;
  full_name: string;
  student_number: string;
  phone?: string;
  active_route_id?: number | null;
  stop_id?: number | null;
  is_approved?: boolean;
}): Promise<Student> {
  const { data } = await api.post<{ student_profile: Student }>(
    "/api/users/students",
    payload
  );
  return data.student_profile;
}

export async function approveStudent(userId: number): Promise<void> {
  await api.post(`/api/users/students/${userId}/approve`);
}

export async function assignStudentRoute(
  studentProfileId: number,
  payload: { active_route_id: number | null; stop_id?: number | null }
): Promise<Student> {
  const { data } = await api.patch<{ student_profile: Student }>(
    `/api/users/students/${studentProfileId}/route`,
    payload
  );
  return data.student_profile;
}
