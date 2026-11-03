import { useCallback, useEffect, useState } from "react";
import { listSosAlerts, resolveSosAlert } from "../api/alerts";
import { getErrorMessage } from "../api/client";
import type { SosAlert } from "../api/types";

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatCoords(
  lat: number | null | undefined,
  lng: number | null | undefined
): string {
  if (lat == null || lng == null) return "No location";
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "No location";
  if (lat === 0 && lng === 0) return "No location";
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export default function SosPage() {
  const [alerts, setAlerts] = useState<SosAlert[]>([]);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listSosAlerts(
        filter === "all" ? undefined : filter
      );
      setAlerts(list);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [refresh]);

  async function onResolve(id: number) {
    setResolvingId(id);
    setError(null);
    try {
      await resolveSosAlert(id);
      await refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <div>
      <h1>SOS alerts</h1>
      <p className="muted">
        Driver emergency signals. Open alerts refresh every ~15s.
      </p>

      <div className="row-actions" style={{ marginBottom: 16 }}>
        {(["open", "all", "resolved"] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={filter === f ? "small-btn" : "ghost small-btn"}
            onClick={() => setFilter(f)}
          >
            {f === "open" ? "Open" : f === "all" ? "All recent" : "Resolved"}
          </button>
        ))}
        <button type="button" className="ghost small-btn" onClick={() => refresh()}>
          Refresh
        </button>
      </div>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && alerts.length === 0 ? (
        <p className="muted">No SOS alerts in this view.</p>
      ) : null}

      {alerts.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Status</th>
                <th>Driver</th>
                <th>Trip</th>
                <th>Location</th>
                <th>Created</th>
                <th>Resolved</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id}>
                  <td>{a.id}</td>
                  <td>
                    <span
                      className={
                        a.status === "open" ? "badge danger" : "badge ok"
                      }
                    >
                      {a.status}
                    </span>
                  </td>
                  <td>{a.driver_name || `#${a.driver_id}`}</td>
                  <td>{a.trip_id ?? "—"}</td>
                  <td>{formatCoords(a.latitude, a.longitude)}</td>
                  <td>{formatWhen(a.created_at)}</td>
                  <td>{formatWhen(a.resolved_at)}</td>
                  <td>
                    {a.status === "open" ? (
                      <button
                        type="button"
                        className="small-btn"
                        disabled={resolvingId === a.id}
                        onClick={() => onResolve(a.id)}
                      >
                        {resolvingId === a.id ? "…" : "Resolve"}
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
