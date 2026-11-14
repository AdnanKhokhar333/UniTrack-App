import { FormEvent, useEffect, useState } from "react";
import { listBuses } from "../api/buses";
import { getErrorMessage } from "../api/client";
import {
  createDriver,
  deleteDriver,
  listDrivers,
  updateDriver,
} from "../api/drivers";
import type { Bus, Driver } from "../api/types";
import ConfirmDialog from "../components/ConfirmDialog";

const emptyForm = {
  email: "",
  password: "",
  full_name: "",
  phone: "",
  license_number: "",
  bus_id: "",
};

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Driver | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [driverList, busList] = await Promise.all([
        listDrivers(),
        listBuses(),
      ]);
      setDrivers(driverList);
      setBuses(busList);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function busLabel(busId: number | null) {
    if (busId == null) return null;
    const bus = buses.find((b) => b.id === busId);
    return bus ? bus.bus_number : `#${busId}`;
  }

  function startEdit(driver: Driver) {
    setEditingId(driver.id);
    setSuccess(null);
    setForm({
      email: driver.email ?? "",
      password: "",
      full_name: driver.full_name,
      phone: driver.phone ?? "",
      license_number: driver.license_number ?? "",
      bus_id: driver.bus_id != null ? String(driver.bus_id) : "",
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (editingId != null) {
        const payload: {
          full_name: string;
          phone: string | null;
          license_number: string | null;
          bus_id: number | null;
          password?: string;
        } = {
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || null,
          license_number: form.license_number.trim() || null,
          bus_id: form.bus_id ? Number(form.bus_id) : null,
        };
        if (form.password.trim()) {
          payload.password = form.password;
        }
        await updateDriver(editingId, payload);
        setSuccess("Driver updated.");
      } else {
        await createDriver({
          email: form.email.trim(),
          password: form.password,
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || undefined,
          license_number: form.license_number.trim() || undefined,
          bus_id: form.bus_id ? Number(form.bus_id) : null,
        });
        setSuccess("Driver created.");
      }
      resetForm();
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
    setSuccess(null);
    try {
      await deleteDriver(pendingDelete.id);
      setPendingDelete(null);
      setSuccess("Driver deactivated.");
      if (editingId === pendingDelete.id) resetForm();
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
        <h1>Drivers</h1>
        <p className="muted">
          Manage driver accounts, contact details, and bus assignments.
        </p>
      </div>

      {error && <p className="error">{error}</p>}
      {success && <p className="success-msg">{success}</p>}

      <form
        className="panel-form"
        onSubmit={onSubmit}
        autoComplete="off"
      >
        <h2>{editingId != null ? "Edit driver" : "Create driver"}</h2>
        <div className="form-grid">
          <label>
            Email
            <input
              type="email"
              name="unitrack-driver-email"
              autoComplete="off"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="driver@university.edu"
              required={editingId == null}
              disabled={editingId != null}
              readOnly={editingId != null}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="unitrack-driver-password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              placeholder={
                editingId != null
                  ? "Leave blank to keep current"
                  : "Min. 6 characters"
              }
              required={editingId == null}
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
              placeholder="e.g. Ahmed Khan"
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
            License number
            <input
              autoComplete="off"
              value={form.license_number}
              onChange={(e) =>
                setForm((f) => ({ ...f, license_number: e.target.value }))
              }
              placeholder="e.g. LHR-21-9845"
            />
          </label>
          <label>
            Bus
            <select
              value={form.bus_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, bus_id: e.target.value }))
              }
            >
              <option value="">Unassigned</option>
              {buses
                .filter(
                  (bus) =>
                    bus.is_active ||
                    (form.bus_id !== "" && bus.id === Number(form.bus_id))
                )
                .map((bus) => (
                  <option key={bus.id} value={bus.id}>
                    {bus.bus_number} ({bus.registration})
                    {!bus.is_active ? " — inactive" : ""}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" className="primary-cta" disabled={saving}>
            {saving
              ? editingId != null
                ? "Saving…"
                : "Creating…"
              : editingId != null
                ? "Update driver"
                : "Create driver"}
          </button>
          {editingId != null && (
            <button type="button" className="ghost" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="table-wrap">
          <div className="table-toolbar">
            <h2 className="table-title">Drivers</h2>
            <span className="count-badge">{drivers.length} Total Drivers</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>License</th>
                <th>Bus</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {drivers.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    No drivers yet.
                  </td>
                </tr>
              )}
              {drivers.map((driver) => {
                const assigned = busLabel(driver.bus_id);
                const active = driver.is_active !== false;
                return (
                  <tr key={driver.id}>
                    <td>{driver.full_name}</td>
                    <td>{driver.email ?? "—"}</td>
                    <td>{driver.phone ?? "—"}</td>
                    <td>{driver.license_number ?? "—"}</td>
                    <td>
                      {assigned ? (
                        <span className="bus-assign-badge">{assigned}</span>
                      ) : (
                        <span className="status-pill status-pill--muted">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        className={
                          active
                            ? "status-pill status-pill--active"
                            : "status-pill status-pill--inactive"
                        }
                      >
                        {active ? "• Active" : "• Deactivated"}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="ghost small-btn"
                          onClick={() => startEdit(driver)}
                          disabled={!active}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="danger-outline small-btn"
                          onClick={() => setPendingDelete(driver)}
                          disabled={!active}
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
        title="Delete driver"
        message="Are you sure you want to delete this driver?"
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
