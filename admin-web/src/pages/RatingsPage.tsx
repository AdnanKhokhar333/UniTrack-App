import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "../api/client";
import { listRatings } from "../api/ratings";
import type { DriverAverage, DriverRating } from "../api/types";

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function StarsDisplay({ value }: { value: number }) {
  const clamped = Math.min(5, Math.max(0, value));
  const filled = Math.round(clamped);
  const glyphs = Array.from({ length: 5 }, (_, i) => (
    <span key={i} className={i < filled ? undefined : "star-empty"}>
      ★
    </span>
  ));
  return (
    <span className="stars-display" title={`${clamped.toFixed(1)} / 5`}>
      <span className="stars-glyphs">{glyphs}</span>
      <span className="stars-value">{clamped.toFixed(1)}</span>
    </span>
  );
}

function EmptyRatings() {
  return (
    <div className="empty-state">
      <span className="empty-state-icon empty-state-icon--star" aria-hidden>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.5l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 16.4 6.6 19.3l1-6.1L3.2 8.9l6.1-.9L12 2.5z" />
        </svg>
      </span>
      <p className="empty-state-msg">No student ratings submitted yet.</p>
    </div>
  );
}

export default function RatingsPage() {
  const [ratings, setRatings] = useState<DriverRating[]>([]);
  const [averages, setAverages] = useState<DriverAverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listRatings();
      setRatings(data.ratings);
      setAverages(data.averages);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const nameByDriver = new Map(
    averages.map((a) => [a.driver_id, a.driver_name])
  );

  return (
    <div>
      <div className="page-header-row">
        <div>
          <h1>Driver ratings</h1>
          <p className="muted">
            Student 1–5 star feedback with per-driver averages.
          </p>
        </div>
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
        <>
          <div className="table-wrap">
            <div className="table-toolbar">
              <h2 className="table-title">Averages by driver</h2>
              <span className="count-badge">
                {averages.length}{" "}
                {averages.length === 1 ? "Driver" : "Drivers"}
              </span>
            </div>
            {averages.length === 0 ? (
              <EmptyRatings />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Driver</th>
                    <th>Avg stars</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {averages.map((a) => (
                    <tr key={a.driver_id}>
                      <td>{a.driver_name || `#${a.driver_id}`}</td>
                      <td>
                        <StarsDisplay value={a.avg_stars} />
                      </td>
                      <td>{a.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="table-wrap" style={{ marginTop: "1.25rem" }}>
            <div className="table-toolbar">
              <h2 className="table-title">Recent ratings</h2>
              <span className="count-badge">
                {ratings.length}{" "}
                {ratings.length === 1 ? "Rating" : "Ratings"}
              </span>
            </div>
            {ratings.length === 0 ? (
              <EmptyRatings />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Driver</th>
                    <th>Student</th>
                    <th>Stars</th>
                    <th>Trip</th>
                    <th>Comment</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {ratings.map((r) => {
                    const name = nameByDriver.get(r.driver_id);
                    return (
                      <tr key={r.id}>
                        <td>{r.id}</td>
                        <td>
                          {name ? `${name}` : `#${r.driver_id}`}
                        </td>
                        <td>#{r.student_id}</td>
                        <td>
                          <StarsDisplay value={r.stars} />
                        </td>
                        <td>
                          {r.trip_id != null ? (
                            <span className="entity-pill">Trip #{r.trip_id}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>{r.comment || "—"}</td>
                        <td>{formatWhen(r.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
