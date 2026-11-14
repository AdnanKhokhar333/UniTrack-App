import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAttendanceSummary } from "../api/attendance";
import { listBuses } from "../api/buses";
import { getErrorMessage } from "../api/client";
import { listDrivers } from "../api/drivers";
import { listRoutes } from "../api/routes";
import { listStudents } from "../api/students";
import { listActiveTrips } from "../api/trips";

type Counts = {
  buses: number;
  drivers: number;
  routes: number;
  studentsApproved: number;
  studentsPending: number;
  activeTrips: number;
  takingToday: number;
  absentToday: number;
  markedToday: number;
};

function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}

function BusGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="4" y="4" width="16" height="12" rx="2" />
      <path d="M4 12h16" />
      <circle cx="8" cy="18" r="1.5" />
      <circle cx="16" cy="18" r="1.5" />
    </svg>
  );
}

function StatIconBus() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="4" y="4" width="16" height="12" rx="2" />
      <path d="M4 12h16" />
      <circle cx="8" cy="18" r="1.5" />
      <circle cx="16" cy="18" r="1.5" />
    </svg>
  );
}

function StatIconDriver() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
    </svg>
  );
}

function StatIconRoute() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8 7.5c3 0 5 9 8 9" />
    </svg>
  );
}

function StatIconTrip() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <path d="M9 3v18M15 6v18" />
    </svg>
  );
}

function IconPlusBus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="5" width="16" height="11" rx="2" />
      <path d="M4 12h16M8 19v0M16 19v0M12 7v4M10 9h4" />
    </svg>
  );
}

function IconPlusDriver() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="10" cy="8" r="3" />
      <path d="M4 19c1.2-3 3.2-4.5 6-4.5M16 11v6M13 14h6" />
    </svg>
  );
}

function IconPlusRoute() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M8 7c3 0 5 10 8 10M16 8h4M18 6v4" />
    </svg>
  );
}

function IconPlusStudent() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19v-1.5A4.5 4.5 0 0 1 8.5 13h1" />
      <circle cx="10" cy="8" r="3" />
      <path d="M16 11v6M13 14h6" />
    </svg>
  );
}

function IconLiveMap() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <path d="M9 3v18M15 6v18" />
    </svg>
  );
}

function IconSos() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l8 14H4L12 3z" />
      <path d="M12 10v3M12 16h.01" />
    </svg>
  );
}

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
        const [buses, drivers, routes, students, trips, attendance] =
          await Promise.all([
            listBuses(),
            listDrivers(),
            listRoutes(),
            listStudents(),
            listActiveTrips(),
            getAttendanceSummary(),
          ]);
        if (cancelled) return;
        setCounts({
          buses: buses.length,
          drivers: drivers.length,
          routes: routes.length,
          studentsApproved: students.filter((s) => s.is_approved).length,
          studentsPending: students.filter((s) => !s.is_approved).length,
          activeTrips: trips.length,
          takingToday: attendance.taking_count,
          absentToday: attendance.absent_count,
          markedToday: attendance.total_marked,
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

  const approved = counts?.studentsApproved ?? 0;
  const notMarked = Math.max(0, approved - (counts?.markedToday ?? 0));
  const takingPct = pct(counts?.takingToday ?? 0, approved);
  const absentPct = pct(counts?.absentToday ?? 0, approved);
  const notMarkedPct = pct(notMarked, approved);
  const tripLive = (counts?.activeTrips ?? 0) > 0;

  return (
    <div>
      <div className="page-header">
        <h1>Transport Operations Overview</h1>
        <p className="muted">
          Real-time monitoring of university buses, active routes, and daily student attendance.
        </p>
      </div>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error}</p>}

      {counts && (
        <>
          <div className="stat-grid primary-stats">
            <Link to="/buses" className="stat stat-blue stat-link">
              <span className="stat-card-icon" aria-hidden>
                <StatIconBus />
              </span>
              <span className="stat-value">{counts.buses}</span>
              <span className="stat-label">Buses</span>
              <span className="stat-hint">Fleet vehicles</span>
            </Link>
            <Link to="/drivers" className="stat stat-green stat-link">
              <span className="stat-card-icon" aria-hidden>
                <StatIconDriver />
              </span>
              <span className="stat-value">{counts.drivers}</span>
              <span className="stat-label">Drivers</span>
              <span className="stat-hint">Assigned operators</span>
            </Link>
            <Link to="/routes" className="stat stat-violet stat-link">
              <span className="stat-card-icon" aria-hidden>
                <StatIconRoute />
              </span>
              <span className="stat-value">{counts.routes}</span>
              <span className="stat-label">Routes</span>
              <span className="stat-hint">Active corridors</span>
            </Link>
            <Link to="/live-map" className="stat stat-amber stat-link">
              <span className="stat-card-icon" aria-hidden>
                <StatIconTrip />
              </span>
              <span className="stat-value">{counts.activeTrips}</span>
              <span className="stat-label">Active trips</span>
              <span className="stat-hint">On the road now</span>
            </Link>
          </div>

          <div className="dashboard-grid">
            <section className="dash-panel">
              <h2 className="dash-panel-title">Attendance overview</h2>
              <p className="dash-panel-sub">
                Daily student boarding &amp; attendance breakdown
              </p>
              <div className="attendance-bars">
                <div className="att-row">
                  <span className="att-label">Taking Bus</span>
                  <div className="att-track">
                    <div className="att-fill taking" style={{ width: `${takingPct}%` }} />
                  </div>
                  <span className="att-count">{counts.takingToday}</span>
                </div>
                <div className="att-row">
                  <span className="att-label">Absent</span>
                  <div className="att-track">
                    <div className="att-fill absent" style={{ width: `${absentPct}%` }} />
                  </div>
                  <span className="att-count">{counts.absentToday}</span>
                </div>
                <div className="att-row">
                  <span className="att-label">Not Marked Yet</span>
                  <div className="att-track">
                    <div className="att-fill unmarked" style={{ width: `${notMarkedPct}%` }} />
                  </div>
                  <span className="att-count">{notMarked}</span>
                </div>
              </div>
            </section>

            <section className="dash-panel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 className="dash-panel-title">Trip status</h2>
                {tripLive ? <span className="live-pill">Live</span> : null}
              </div>
              <div className="trip-status">
                <div
                  className="trip-ring"
                  style={{ ["--pct" as string]: tripLive ? 72 : 8 }}
                  aria-hidden
                >
                  <div className="trip-ring-inner">
                    <BusGlyph />
                  </div>
                </div>
                <div>
                  <strong style={{ fontSize: "1.05rem" }}>
                    {counts.activeTrips} active trip{counts.activeTrips === 1 ? "" : "s"}
                  </strong>
                  <p className="dash-panel-sub" style={{ marginTop: 4 }}>
                    {tripLive
                      ? "On the road — open the live map for positions."
                      : "No trips running right now."}
                  </p>
                </div>
                <Link
                  to="/live-map"
                  className="quick-action qa-violet"
                  style={{ width: "100%", alignItems: "center", flexDirection: "row", justifyContent: "center" }}
                >
                  View Live Map
                </Link>
              </div>
            </section>
          </div>

          <div className="dashboard-grid" style={{ marginTop: "1rem" }}>
            <section className="dash-panel dash-panel-enrollment">
              <h2 className="dash-panel-title">Enrollment snapshot</h2>
              <p className="dash-panel-sub">Approved vs pending student accounts.</p>
              <div className="stat-grid secondary-stats" style={{ marginTop: 0 }}>
                <div className="stat stat-green">
                  <span className="stat-value">{counts.studentsApproved}</span>
                  <span className="stat-label">Approved</span>
                </div>
                <div className="stat stat-amber">
                  <span className="stat-value">{counts.studentsPending}</span>
                  <span className="stat-label">Pending</span>
                </div>
              </div>
              <Link to="/students" className="enrollment-cta">
                Manage All Students →
              </Link>
            </section>

            <section className="dash-panel">
              <h2 className="dash-panel-title">Quick actions</h2>
              <p className="dash-panel-sub">Quick shortcuts for daily transport tasks.</p>
              <div className="quick-actions">
                <Link to="/buses" className="quick-action qa-blue">
                  <span className="quick-action-icon">
                    <IconPlusBus />
                  </span>
                  Add Bus
                </Link>
                <Link to="/drivers" className="quick-action qa-green">
                  <span className="quick-action-icon">
                    <IconPlusDriver />
                  </span>
                  Add Driver
                </Link>
                <Link to="/routes" className="quick-action qa-violet">
                  <span className="quick-action-icon">
                    <IconPlusRoute />
                  </span>
                  Create Route
                </Link>
                <Link to="/students" className="quick-action qa-amber">
                  <span className="quick-action-icon">
                    <IconPlusStudent />
                  </span>
                  Add Student
                </Link>
                <Link to="/live-map" className="quick-action qa-violet">
                  <span className="quick-action-icon">
                    <IconLiveMap />
                  </span>
                  Live Map
                </Link>
                <Link to="/sos" className="quick-action qa-red">
                  <span className="quick-action-icon">
                    <IconSos />
                  </span>
                  SOS Alerts
                </Link>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
