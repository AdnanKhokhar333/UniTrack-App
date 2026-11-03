import { useEffect, useState } from "react";
import { listBuses } from "../api/buses";
import { getErrorMessage } from "../api/client";
import { listDrivers } from "../api/drivers";
import { listRoutes } from "../api/routes";
import { listStudents } from "../api/students";

type Counts = {
  buses: number;
  drivers: number;
  routes: number;
  studentsApproved: number;
  studentsPending: number;
};

export default function DashboardPage() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [buses, drivers, routes, students] = await Promise.all([
          listBuses(),
          listDrivers(),
          listRoutes(),
          listStudents(),
        ]);
        if (cancelled) return;
        setCounts({
          buses: buses.length,
          drivers: drivers.length,
          routes: routes.length,
          studentsApproved: students.filter((s) => s.is_approved).length,
          studentsPending: students.filter((s) => !s.is_approved).length,
        });
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1>Dashboard</h1>
      <p className="muted">Fleet and enrollment summary.</p>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error}</p>}

      {counts && (
        <div className="stat-grid">
          <div className="stat">
            <span className="stat-value">{counts.buses}</span>
            <span className="stat-label">Buses</span>
          </div>
          <div className="stat">
            <span className="stat-value">{counts.drivers}</span>
            <span className="stat-label">Drivers</span>
          </div>
          <div className="stat">
            <span className="stat-value">{counts.routes}</span>
            <span className="stat-label">Routes</span>
          </div>
          <div className="stat">
            <span className="stat-value">{counts.studentsApproved}</span>
            <span className="stat-label">Students approved</span>
          </div>
          <div className="stat">
            <span className="stat-value">{counts.studentsPending}</span>
            <span className="stat-label">Students pending</span>
          </div>
        </div>
      )}
    </div>
  );
}
