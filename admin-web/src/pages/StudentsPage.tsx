import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { getErrorMessage } from "../api/client";
import { listRoutes } from "../api/routes";
import {
  approveStudent,
  assignStudentRoute,
  bulkUploadStudentsCsv,
  createStudent,
  deleteStudent,
  listStudents,
  revokeStudent,
} from "../api/students";
import type { BulkStudentResult, Route, Student } from "../api/types";
import ConfirmDialog from "../components/ConfirmDialog";

const emptyForm = {
  email: "",
  password: "",
  full_name: "",
  student_number: "",
  phone: "",
  active_route_id: "",
  stop_id: "",
  is_approved: true,
};

const SAMPLE_CSV = [
  "email,password,full_name,student_number,phone,active_route_id,stop_id",
  "student@university.edu,changeme,Ali Khan,S23-0178,03XX-XXXXXXX,,",
].join("\n");

function downloadSampleCsv() {
  const blob = new Blob([`${SAMPLE_CSV}\n`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "unitrack-students-sample.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [assignRouteId, setAssignRouteId] = useState("");
  const [assignStopId, setAssignStopId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkStudentResult | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [studentList, routeList] = await Promise.all([
        listStudents(),
        listRoutes(),
      ]);
      setStudents(studentList);
      setRoutes(routeList);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const createStops = useMemo(() => {
    const route = routes.find((r) => r.id === Number(form.active_route_id));
    return [...(route?.stops ?? [])].sort(
      (a, b) => a.sequence_order - b.sequence_order
    );
  }, [routes, form.active_route_id]);

  const assignStops = useMemo(() => {
    const route = routes.find((r) => r.id === Number(assignRouteId));
    return [...(route?.stops ?? [])].sort(
      (a, b) => a.sequence_order - b.sequence_order
    );
  }, [routes, assignRouteId]);

  function routeLabel(routeId: number | null) {
    if (routeId == null) return "—";
    const route = routes.find((r) => r.id === routeId);
    return route ? route.name : `#${routeId}`;
  }

  function stopLabel(stopId: number | null) {
    if (stopId == null) return "—";
    for (const route of routes) {
      const stop = route.stops?.find((s) => s.id === stopId);
      if (stop) return stop.name;
    }
    return `#${stopId}`;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createStudent({
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        student_number: form.student_number.trim(),
        phone: form.phone.trim() || undefined,
        active_route_id: form.active_route_id
          ? Number(form.active_route_id)
          : null,
        stop_id: form.stop_id ? Number(form.stop_id) : null,
        is_approved: form.is_approved,
      });
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function onApprove(userId: number) {
    setError(null);
    try {
      await approveStudent(userId);
      await refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function onRevoke(userId: number) {
    setError(null);
    try {
      await revokeStudent(userId);
      await refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function onBulkUpload(e: FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a CSV file first");
      return;
    }
    setBulkBusy(true);
    setError(null);
    setBulkResult(null);
    try {
      const result = await bulkUploadStudentsCsv(file);
      setBulkResult(result);
      if (fileRef.current) fileRef.current.value = "";
      await refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBulkBusy(false);
    }
  }

  function startAssign(student: Student) {
    setAssigningId(student.id);
    setAssignRouteId(
      student.active_route_id != null ? String(student.active_route_id) : ""
    );
    setAssignStopId(student.stop_id != null ? String(student.stop_id) : "");
  }

  async function onAssign(e: FormEvent) {
    e.preventDefault();
    if (assigningId == null) return;
    setSaving(true);
    setError(null);
    try {
      await assignStudentRoute(assigningId, {
        active_route_id: assignRouteId ? Number(assignRouteId) : null,
        stop_id: assignStopId ? Number(assignStopId) : null,
      });
      setAssigningId(null);
      setAssignRouteId("");
      setAssignStopId("");
      await refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteStudent(pendingDelete.id);
      setPendingDelete(null);
      if (assigningId === pendingDelete.id) {
        setAssigningId(null);
        setAssignRouteId("");
        setAssignStopId("");
      }
      await refresh();
    } catch (err) {
      setError(getErrorMessage(err));
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Students</h1>
        <p className="muted">
          Enroll students, manage bus passes, and assign each rider to one
          active route.
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      <form className="panel-form" onSubmit={onBulkUpload} autoComplete="off">
        <h2>CSV bulk upload</h2>
        <p className="muted small">
          Required: email, password, full name, and roll number. Optional:
          phone, route ID, and stop ID. Duplicate emails or roll numbers are
          reported per row.
        </p>
        <div className="form-grid">
          <label>
            CSV file
            <input ref={fileRef} type="file" accept=".csv,text/csv" required />
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" className="primary-cta" disabled={bulkBusy}>
            {bulkBusy ? "Uploading…" : "Upload CSV"}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={downloadSampleCsv}
          >
            Download Sample CSV
          </button>
        </div>
        {bulkResult && (
          <p className="muted" style={{ marginTop: 12 }}>
            Created {bulkResult.created}, failed {bulkResult.failed}.
            {bulkResult.errors.length > 0 && (
              <span>
                {" "}
                Errors:{" "}
                {bulkResult.errors
                  .slice(0, 5)
                  .map((e) => `row ${e.row}: ${e.error}`)
                  .join("; ")}
                {bulkResult.errors.length > 5 ? "…" : ""}
              </span>
            )}
          </p>
        )}
      </form>

      <form className="panel-form" onSubmit={onSubmit} autoComplete="off">
        <h2>Create student</h2>
        <div className="form-grid">
          <label>
            Email
            <input
              type="email"
              name="unitrack-student-email"
              autoComplete="off"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="student@university.edu"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="unitrack-student-password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              placeholder="Min. 6 characters"
              required
            />
          </label>
          <label>
            Full name
            <input
              autoComplete="off"
              value={form.full_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, full_name: e.target.value }))
              }
              placeholder="e.g. Ali Khan"
              required
            />
          </label>
          <label>
            Roll Number
            <input
              autoComplete="off"
              value={form.student_number}
              onChange={(e) =>
                setForm((f) => ({ ...f, student_number: e.target.value }))
              }
              placeholder="e.g. S23-0178"
              required
            />
          </label>
          <label>
            Phone
            <input
              autoComplete="off"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="e.g. 03XX-XXXXXXX"
            />
          </label>
          <label>
            Active route
            <select
              value={form.active_route_id}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  active_route_id: e.target.value,
                  stop_id: "",
                }))
              }
            >
              <option value="">Unassigned</option>
              {routes.map((route) => (
                <option key={route.id} value={route.id}>
                  {route.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Stop
            <select
              value={form.stop_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, stop_id: e.target.value }))
              }
              disabled={!form.active_route_id}
            >
              <option value="">None</option>
              {createStops.map((stop) => (
                <option key={stop.id} value={stop.id}>
                  Stop {stop.sequence_order}: {stop.name}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.is_approved}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_approved: e.target.checked }))
              }
            />
            Approve on create
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" className="primary-cta" disabled={saving}>
            {saving ? "Creating…" : "Create student"}
          </button>
        </div>
      </form>

      {assigningId != null && (
        <form className="panel-form" onSubmit={onAssign} autoComplete="off">
          <h2>Assign / reassign route</h2>
          <div className="form-grid">
            <label>
              Route
              <select
                value={assignRouteId}
                onChange={(e) => {
                  setAssignRouteId(e.target.value);
                  setAssignStopId("");
                }}
              >
                <option value="">Unassigned</option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Stop
              <select
                value={assignStopId}
                onChange={(e) => setAssignStopId(e.target.value)}
                disabled={!assignRouteId}
              >
                <option value="">None</option>
                {assignStops.map((stop) => (
                  <option key={stop.id} value={stop.id}>
                    Stop {stop.sequence_order}: {stop.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="primary-cta" disabled={saving}>
              {saving ? "Saving…" : "Save assignment"}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => setAssigningId(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="table-wrap">
          <div className="table-toolbar">
            <h2 className="table-title">Students</h2>
            <span className="count-badge">
              {students.length} Total Students
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Roll No.</th>
                <th>Email</th>
                <th>Status</th>
                <th>Route</th>
                <th>Stop</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    No students yet.
                  </td>
                </tr>
              )}
              {students.map((student) => {
                const active = student.is_active !== false;
                return (
                  <tr key={student.id}>
                    <td>{student.full_name}</td>
                    <td>{student.student_number}</td>
                    <td>{student.email ?? "—"}</td>
                    <td>
                      {!active ? (
                        <span className="status-pill status-pill--inactive">
                          • Deactivated
                        </span>
                      ) : student.is_approved ? (
                        <span className="badge ok">Approved</span>
                      ) : (
                        <span className="badge pending">Pending</span>
                      )}
                    </td>
                    <td>{routeLabel(student.active_route_id)}</td>
                    <td>{stopLabel(student.stop_id)}</td>
                    <td>
                      <div className="row-actions">
                        {active &&
                          (!student.is_approved ? (
                            <button
                              type="button"
                              className="ghost small-btn"
                              onClick={() => onApprove(student.user_id)}
                            >
                              Approve
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="ghost small-btn"
                              onClick={() => onRevoke(student.user_id)}
                            >
                              Revoke pass
                            </button>
                          ))}
                        {active && (
                          <button
                            type="button"
                            className="ghost small-btn"
                            onClick={() => startAssign(student)}
                          >
                            Assign route
                          </button>
                        )}
                        <button
                          type="button"
                          className="danger-outline small-btn"
                          onClick={() => setPendingDelete(student)}
                          disabled={!active}
                          title={
                            active
                              ? "Deactivate student"
                              : "Already deactivated"
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete != null}
        title="Delete student"
        message="Are you sure you want to delete this student?"
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
