import { FormEvent, useEffect, useState } from "react";
import { listBuses } from "../api/buses";
import { getErrorMessage } from "../api/client";
import { createDriver, listDrivers } from "../api/drivers";
import type { Bus, Driver } from "../api/types";

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
  const [form, setForm] = useState(emptyForm);

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
    if (busId == null) return "—";
    const bus = buses.find((b) => b.id === busId);
    return bus ? bus.bus_number : `#${busId}`;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createDriver({
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || undefined,
        license_number: form.license_number.trim() || undefined,
        bus_id: form.bus_id ? Number(form.bus_id) : null,
      });
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1>Drivers</h1>
      <p className="muted">Create driver accounts and optional bus assignment.</p>

      {error && <p className="error">{error}</p>}

      <form className="panel-form" onSubmit={onSubmit}>
        <h2>Create driver</h2>
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
            Phone
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </label>
          <label>
            License number
            <input
              value={form.license_number}
              onChange={(e) =>
                setForm((f) => ({ ...f, license_number: e.target.value }))
              }
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
              {buses.map((bus) => (
                <option key={bus.id} value={bus.id}>
                  {bus.bus_number} ({bus.registration})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create driver"}
          </button>
        </div>
      </form>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>License</th>
                <th>Bus</th>
              </tr>
            </thead>
            <tbody>
              {drivers.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    No drivers yet.
                  </td>
                </tr>
              )}
              {drivers.map((driver) => (
                <tr key={driver.id}>
                  <td>{driver.full_name}</td>
                  <td>{driver.email ?? "—"}</td>
                  <td>{driver.phone ?? "—"}</td>
                  <td>{driver.license_number ?? "—"}</td>
                  <td>{busLabel(driver.bus_id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
