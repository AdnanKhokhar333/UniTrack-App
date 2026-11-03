import { FormEvent, useEffect, useState } from "react";
import { createBus, listBuses, updateBus } from "../api/buses";
import { getErrorMessage } from "../api/client";
import type { Bus } from "../api/types";

const emptyForm = {
  bus_number: "",
  registration: "",
  capacity: 40,
  is_active: true,
};

export default function BusesPage() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setBuses(await listBuses());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function startEdit(bus: Bus) {
    setEditingId(bus.id);
    setForm({
      bus_number: bus.bus_number,
      registration: bus.registration,
      capacity: bus.capacity,
      is_active: bus.is_active,
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
    try {
      const payload = {
        bus_number: form.bus_number.trim(),
        registration: form.registration.trim(),
        capacity: Number(form.capacity),
        is_active: form.is_active,
      };
      if (editingId != null) {
        await updateBus(editingId, payload);
      } else {
        await createBus(payload);
      }
      resetForm();
      await refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1>Buses</h1>
      <p className="muted">Manage fleet vehicles.</p>

      {error && <p className="error">{error}</p>}

      <form className="panel-form" onSubmit={onSubmit}>
        <h2>{editingId != null ? "Edit bus" : "Create bus"}</h2>
        <div className="form-grid">
          <label>
            Bus number
            <input
              value={form.bus_number}
              onChange={(e) =>
                setForm((f) => ({ ...f, bus_number: e.target.value }))
              }
              required
            />
          </label>
          <label>
            Registration
            <input
              value={form.registration}
              onChange={(e) =>
                setForm((f) => ({ ...f, registration: e.target.value }))
              }
              required
            />
          </label>
          <label>
            Capacity
            <input
              type="number"
              min={1}
              value={form.capacity}
              onChange={(e) =>
                setForm((f) => ({ ...f, capacity: Number(e.target.value) }))
              }
              required
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_active: e.target.checked }))
              }
            />
            Active
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving
              ? "Saving…"
              : editingId != null
                ? "Update bus"
                : "Create bus"}
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
          <table>
            <thead>
              <tr>
                <th>Bus #</th>
                <th>Registration</th>
                <th>Capacity</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {buses.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    No buses yet.
                  </td>
                </tr>
              )}
              {buses.map((bus) => (
                <tr key={bus.id}>
                  <td>{bus.bus_number}</td>
                  <td>{bus.registration}</td>
                  <td>{bus.capacity}</td>
                  <td>{bus.is_active ? "Active" : "Inactive"}</td>
                  <td>
                    <button
                      type="button"
                      className="ghost small-btn"
                      onClick={() => startEdit(bus)}
                    >
                      Edit
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
