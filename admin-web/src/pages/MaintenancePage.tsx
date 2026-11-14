import { FormEvent, useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "../api/client";
import {
  createMaintenanceLog,
  listBusMaintenance,
} from "../api/maintenance";
import type { BusMaintenanceBundle } from "../api/types";

export default function MaintenancePage() {
  const [bundles, setBundles] = useState<BusMaintenanceBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busId, setBusId] = useState("");
  const [note, setNote] = useState("");
  const [liters, setLiters] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listBusMaintenance();
      setBundles(data.buses);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!busId || !note.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createMaintenanceLog({
        bus_id: Number(busId),
        note: note.trim(),
        liters_added: liters.trim() ? Number(liters) : null,
      });
      setNote("");
      setLiters("");
      await refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1>Fuel &amp; maintenance</h1>
      <p className="muted">
        Automated fuel estimates from GPS trip mileage (8.0 km/L baseline) and
        manual refueling logs.
      </p>

      {error && <p className="error">{error}</p>}

      <form className="panel-form" onSubmit={onSubmit}>
        <h2>Add maintenance / fuel note</h2>
        <div className="form-grid">
          <label>
            Bus
            <select
              value={busId}
              onChange={(e) => setBusId(e.target.value)}
              required
            >
              <option value="">Select…</option>
              {bundles.map((b) => (
                <option key={b.bus.id} value={b.bus.id}>
                  {b.bus.bus_number} ({b.bus.registration})
                </option>
              ))}
            </select>
          </label>
          <label>
            Liters added (optional)
            <input
              type="number"
              step="0.1"
              min="0"
              value={liters}
              onChange={(e) => setLiters(e.target.value)}
              placeholder="45.0"
            />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            Note
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required
              rows={3}
              placeholder="Full tank refuel at PSO Wah Cantt / Engine oil service"
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" className="primary-cta" disabled={saving}>
            {saving ? "Saving…" : "Save note"}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => refresh()}
            disabled={loading}
          >
            Refresh estimates
          </button>
        </div>
      </form>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="table-wrap">
          <div className="table-toolbar">
            <h2 className="table-title">Fleet Fuel &amp; Service Summary</h2>
            <span className="count-badge">
              {bundles.length} {bundles.length === 1 ? "Bus" : "Buses"}
            </span>
          </div>
          {bundles.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon" aria-hidden>
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                >
                  <rect x="3" y="7" width="18" height="10" rx="2" />
                  <circle cx="7.5" cy="17" r="1.5" />
                  <circle cx="16.5" cy="17" r="1.5" />
                </svg>
              </span>
              <p className="empty-state-msg">No buses yet.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Bus</th>
                  <th>Distance (GPS)</th>
                  <th>Est. liters</th>
                  <th>Liters logged</th>
                  <th>Trips</th>
                  <th>Recent notes</th>
                </tr>
              </thead>
              <tbody>
                {bundles.map((b) => (
                  <tr key={b.bus.id}>
                    <td>
                      {b.bus.bus_number}
                      <div className="muted small">{b.bus.registration}</div>
                    </td>
                    <td>{b.fuel.distance_km.toFixed(1)} km</td>
                    <td>
                      {b.fuel.estimated_liters != null
                        ? `${b.fuel.estimated_liters.toFixed(1)} L`
                        : "—"}
                      <div className="muted small">
                        @ {b.fuel.km_per_liter} km/L
                      </div>
                    </td>
                    <td>{b.liters_logged.toFixed(1)} L</td>
                    <td>
                      {b.fuel.trip_count} ({b.fuel.completed_trips} done)
                    </td>
                    <td style={{ maxWidth: 320 }}>
                      {b.recent_logs.length === 0 ? (
                        <span className="muted">—</span>
                      ) : (
                        b.recent_logs.slice(0, 3).map((log) => (
                          <div key={log.id} className="muted small">
                            {log.liters_added != null
                              ? `+${log.liters_added}L · `
                              : ""}
                            {log.note}
                          </div>
                        ))
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
