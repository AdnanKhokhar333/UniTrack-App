import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listSpeedingLogs } from "../api/alerts";
import { getErrorMessage } from "../api/client";
import { listDrivers } from "../api/drivers";
import type { Driver, SpeedingLog } from "../api/types";

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2c-3.3 0-6 2.6-6 5.8 0 4.4 6 13.2 6 13.2s6-8.8 6-13.2C18 4.6 15.3 2 12 2zm0 8.2a2.4 2.4 0 1 1 0-4.8 2.4 2.4 0 0 1 0 4.8z" />
    </svg>
  );
}

export default function SpeedingPage() {
  const [logs, setLogs] = useState<SpeedingLog[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextLogs, nextDrivers] = await Promise.all([
        listSpeedingLogs(),
        listDrivers().catch(() => [] as Driver[]),
      ]);
      setLogs(nextLogs);
      setDrivers(nextDrivers);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const driverNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const d of drivers) map.set(d.id, d.full_name);
    return map;
  }, [drivers]);

  const thresholdKmh = useMemo(() => {
    if (logs.length === 0) return 70;
    return logs[0].threshold_kmh || 70;
  }, [logs]);

  return (
    <div>
      <div className="page-header-row">
        <div>
          <h1>Speeding logs</h1>
          <p className="muted">
            Overspeed events captured from live driver GPS during active trips.
          </p>
        </div>
        <span className="threshold-badge">
          Threshold: {thresholdKmh} km/h
        </span>
      </div>

      <div className="filter-bar">
        <button
          type="button"
          className="ghost small-btn"
          onClick={() => refresh()}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && (
        <div className="table-wrap">
          <div className="table-toolbar">
            <h2 className="table-title">Speeding events</h2>
            <span className="count-badge">
              {logs.length} {logs.length === 1 ? "Event" : "Events"}
            </span>
          </div>
          {logs.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon empty-state-icon--alert" aria-hidden>
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                >
                  <path d="M12 3l9 16H3L12 3z" />
                  <path d="M12 10v4M12 16.5h.01" />
                </svg>
              </span>
              <p className="empty-state-msg">No speeding events logged.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Trip</th>
                  <th>Driver</th>
                  <th>Speed</th>
                  <th>Threshold</th>
                  <th>Location</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const name = driverNameById.get(log.driver_id);
                  const mapsUrl = `https://www.google.com/maps?q=${log.latitude},${log.longitude}`;
                  return (
                    <tr key={log.id}>
                      <td>{log.id}</td>
                      <td>
                        <span className="entity-pill">Trip #{log.trip_id}</span>
                      </td>
                      <td>
                        <span className="entity-pill entity-pill--driver">
                          {name
                            ? `#${log.driver_id} · ${name}`
                            : `#${log.driver_id}`}
                        </span>
                      </td>
                      <td>
                        <span className="speed-badge">
                          {log.speed_kmh.toFixed(1)} km/h
                        </span>
                      </td>
                      <td>{log.threshold_kmh} km/h</td>
                      <td>
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="maps-link"
                        >
                          <PinIcon />
                          {log.latitude.toFixed(5)}, {log.longitude.toFixed(5)}
                        </a>
                        <Link to="/live-map" className="maps-secondary">
                          Live map
                        </Link>
                      </td>
                      <td>{formatWhen(log.recorded_at)}</td>
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
