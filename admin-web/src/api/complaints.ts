import { api } from "./client";
import type { Complaint } from "./types";

export async function listComplaints(
  resolved?: boolean
): Promise<Complaint[]> {
  const { data } = await api.get<{ complaints: Complaint[] }>(
    "/api/complaints",
    {
      params:
        resolved === undefined ? undefined : { resolved: String(resolved) },
    }
  );
  return data.complaints;
}

export async function resolveComplaint(
  complaintId: number,
  isResolved = true
): Promise<Complaint> {
  const { data } = await api.patch<{ complaint: Complaint }>(
    `/api/complaints/${complaintId}/resolve`,
    { is_resolved: isResolved }
  );
  return data.complaint;
}

export async function deleteComplaint(complaintId: number): Promise<void> {
  await api.delete(`/api/complaints/${complaintId}`);
}
