import { FormEvent, useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "../api/client";
import { listRoutes } from "../api/routes";
import {
  approveStudent,
  assignStudentRoute,
  createStudent,
  listStudents,
} from "../api/students";
import type { Route, Student } from "../api/types";

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

  return (
    <div>
      <h1>Students</h1>
      <p className="muted">
        Create students, approve accounts, and assign one active route.
      </p>

      {error && <p className="error">{error}</p>}

      <form className="panel-form" onSubmit={onSubmit}>
        <h2>Create student</h2>
        <div className="form-grid">
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              required
            />
          </label>
          <label>
            Full name
            <input
              value={form.full_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, full_name: e.target.value }))
              }
              required
            />
          </label>
          <label>
            Student number
            <input
              value={form.student_number}
              onChange={(e) =>
                setForm((f) => ({ ...f, student_number: e.target.value }))
              }
              required
            />
          </label>
          <label>
            Phone
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
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
          <button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create student"}
          </button>
        </div>
      </form>

      {assigningId != null && (
        <form className="panel-form" onSubmit={onAssign}>
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
            <button type="submit" disabled={saving}>
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
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Number</th>
                <th>Email</th>
                <th>Status</th>
                <th>Route</th>
                <th>Stop</th>
                <th />
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
              {students.map((student) => (
                <tr key={student.id}>
                  <td>{student.full_name}</td>
                  <td>{student.student_number}</td>
                  <td>{student.email ?? "—"}</td>
                  <td>
                    {student.is_approved ? (
                      <span className="badge ok">Approved</span>
                    ) : (
                      <span className="badge pending">Pending</span>
                    )}
                  </td>
                  <td>{routeLabel(student.active_route_id)}</td>
                  <td>{stopLabel(student.stop_id)}</td>
                  <td className="row-actions">
                    {!student.is_approved && (
                      <button
                        type="button"
                        className="ghost small-btn"
                        onClick={() => onApprove(student.user_id)}
                      >
                        Approve
                      </button>
                    )}
                    <button
                      type="button"
                      className="ghost small-btn"
                      onClick={() => startAssign(student)}
                    >
                      Assign route
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
