import { useCallback, useEffect, useMemo, useState } from "react";
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

function hasGps(
  lat: number | null | undefined,
  lng: number | null | undefined
): boolean {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2c-3.3 0-6 2.6-6 5.8 0 4.4 6 13.2 6 13.2s6-8.8 6-13.2C18 4.6 15.3 2 12 2zm0 8.2a2.4 2.4 0 1 1 0-4.8 2.4 2.4 0 0 1 0 4.8z" />
    </svg>
  );
}

type Filter = "open" | "all" | "resolved";

export default function SosPage() {
  const [alerts, setAlerts] = useState<SosAlert[]>([]);
  const [filter, setFilter] = useState<Filter>("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAlerts(await listSosAlerts());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [refresh]);

  const counts = useMemo(() => {
    const open = alerts.filter((a) => a.status === "open").length;
    const resolved = alerts.filter((a) => a.status === "resolved").length;
    return { open, resolved, all: alerts.length };
  }, [alerts]);

  const visible = useMemo(() => {
    if (filter === "open") return alerts.filter((a) => a.status === "open");
    if (filter === "resolved")
      return alerts.filter((a) => a.status === "resolved");
    return alerts;
  }, [alerts, filter]);

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

      <div className="filter-bar">
        {(
          [
            { key: "open", label: `Open (${counts.open})`, emergency: true },
            {
              key: "resolved",
              label: `Resolved (${counts.resolved})`,
              emergency: false,
            },
            { key: "all", label: `All (${counts.all})`, emergency: false },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            type="button"
            className={[
              "filter-chip",
              filter === f.key ? "filter-chip--active" : "",
              filter === f.key && f.emergency ? "filter-chip--emergency" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          className="ghost small-btn"
          onClick={() => refresh()}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {loading && alerts.length === 0 && <p className="muted">Loading…</p>}
      {error && <p className="error">{error}</p>}

      {(!loading || alerts.length > 0) && (
        <div className="table-wrap">
          <div className="table-toolbar">
            <h2 className="table-title">Emergency alerts</h2>
            <span className="count-badge">
              {visible.length} {visible.length === 1 ? "Alert" : "Alerts"}
            </span>
          </div>
          {visible.length === 0 ? (
            <div className="empty-state">
              <span
                className="empty-state-icon empty-state-icon--shield"
                aria-hidden
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                >
                  <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </span>
              <p className="empty-state-msg">
                {filter === "open"
                  ? "All clear — no active emergency alerts."
                  : "No SOS alerts in this view."}
              </p>
            </div>
          ) : (
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => {
                  const gps = hasGps(a.latitude, a.longitude);
                  return (
                    <tr key={a.id}>
                      <td>{a.id}</td>
                      <td>
                        <span
                          className={
                            a.status === "open"
                              ? "status-pill status-pill--sos"
                              : "status-pill status-pill--resolved"
                          }
                        >
                          {a.status === "open" ? "Open" : "Resolved"}
                        </span>
                      </td>
                      <td>{a.driver_name || `#${a.driver_id}`}</td>
                      <td>
                        {a.trip_id != null ? (
                          <span className="entity-pill">Trip #{a.trip_id}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {gps ? (
                          <a
                            href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="maps-link"
                          >
                            <PinIcon />
                            {a.latitude!.toFixed(5)}, {a.longitude!.toFixed(5)}
                          </a>
                        ) : (
                          <span className="muted">No location</span>
                        )}
                      </td>
                      <td>{formatWhen(a.created_at)}</td>
                      <td>{formatWhen(a.resolved_at)}</td>
                      <td>
                        {a.status === "open" ? (
                          <button
                            type="button"
                            className="primary-cta small-btn"
                            disabled={resolvingId === a.id}
                            onClick={() => onResolve(a.id)}
                          >
                            {resolvingId === a.id ? "…" : "Mark Resolved"}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
