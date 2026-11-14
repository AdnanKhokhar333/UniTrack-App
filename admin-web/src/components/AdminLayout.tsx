import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import BrandMark from "./BrandMark";

export type AdminOutletContext = {
  fleetSearch: string;
  setFleetSearch: (query: string) => void;
};

const navItems = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/live-map", label: "Live Map" },
  { to: "/buses", label: "Buses" },
  { to: "/drivers", label: "Drivers" },
  { to: "/routes", label: "Routes" },
  { to: "/students", label: "Students" },
  { to: "/ratings", label: "Ratings" },
  { to: "/complaints", label: "Complaints" },
  { to: "/speeding", label: "Speeding" },
  { to: "/sos", label: "SOS" },
  { to: "/maintenance", label: "Fuel / Maint." },
];

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/live-map": "Live Map",
  "/buses": "Buses",
  "/drivers": "Drivers",
  "/routes": "Routes",
  "/students": "Students",
  "/ratings": "Ratings",
  "/complaints": "Complaints",
  "/speeding": "Speeding",
  "/sos": "SOS Alerts",
  "/maintenance": "Fuel / Maintenance",
};

function NavIcon({ label }: { label: string }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "nav-icon",
    "aria-hidden": true,
  };

  switch (label) {
    case "Dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      );
    case "Live Map":
      return (
        <svg {...common}>
          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
          <line x1="9" y1="3" x2="9" y2="18" />
          <line x1="15" y1="6" x2="15" y2="21" />
        </svg>
      );
    case "Buses":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="12" rx="2" />
          <path d="M4 12h16" />
          <circle cx="8" cy="18" r="1.5" />
          <circle cx="16" cy="18" r="1.5" />
        </svg>
      );
    case "Drivers":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
        </svg>
      );
    case "Routes":
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="2" />
          <circle cx="18" cy="18" r="2" />
          <path d="M8 7c4 0 4 10 8 10" />
        </svg>
      );
    case "Students":
      return (
        <svg {...common}>
          <path d="M12 4l9 4-9 4-9-4 9-4z" />
          <path d="M5 12v4c0 1.5 3 3 7 3s7-1.5 7-3v-4" />
        </svg>
      );
    case "Ratings":
      return (
        <svg {...common}>
          <polygon points="12 3 14.5 9 21 9.5 16 14 17.5 21 12 17.5 6.5 21 8 14 3 9.5 9.5 9" />
        </svg>
      );
    case "Complaints":
      return (
        <svg {...common}>
          <path d="M5 5h14v11H9l-4 3V5z" />
        </svg>
      );
    case "Speeding":
      return (
        <svg {...common}>
          <circle cx="12" cy="13" r="8" />
          <path d="M12 13l4-4" />
          <path d="M8 9h.01M16 9h.01" />
        </svg>
      );
    case "SOS":
      return (
        <svg {...common}>
          <path d="M12 3l8 14H4L12 3z" />
          <line x1="12" y1="10" x2="12" y2="14" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M4 7h16M4 12h16M4 17h10" />
        </svg>
      );
  }
}

function initials(email?: string | null) {
  if (!email) return "AD";
  const local = email.split("@")[0] || "ad";
  return local.slice(0, 2).toUpperCase();
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [fleetSearch, setFleetSearch] = useState("");
  const isLiveMap = location.pathname === "/live-map";
  const pageTitle = titles[location.pathname] ?? "UniTrack";
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  useEffect(() => {
    if (!isLiveMap) setFleetSearch("");
  }, [isLiveMap]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <BrandMark />
          <p className="sidebar-brand-sub">Admin console</p>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <NavIcon label={item.label} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials(user?.email)}</div>
            <div className="sidebar-user-meta">
              <p className="sidebar-user-name">{user?.email ?? "—"}</p>
              <p className="sidebar-user-role">Administrator</p>
            </div>
          </div>
          <button type="button" className="ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <div className="shell-body">
        <header className="topbar">
          <div className="topbar-search">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="20" y1="20" x2="16.5" y2="16.5" />
            </svg>
            <input
              type="search"
              placeholder="Search fleet, routes…"
              value={fleetSearch}
              onChange={(e) => setFleetSearch(e.target.value)}
              disabled={!isLiveMap}
              aria-label="Search fleet and routes"
            />
          </div>
          <div className="topbar-meta">
            <span>{pageTitle}</span>
            <span aria-hidden>·</span>
            <span>{dateLabel}</span>
          </div>
        </header>
        <main className="shell-main">
          <Outlet
            context={
              {
                fleetSearch,
                setFleetSearch,
              } satisfies AdminOutletContext
            }
          />
        </main>
      </div>
    </div>
  );
}
