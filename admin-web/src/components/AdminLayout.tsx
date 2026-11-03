import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const navItems = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/buses", label: "Buses" },
  { to: "/drivers", label: "Drivers" },
  { to: "/routes", label: "Routes" },
  { to: "/students", label: "Students" },
  { to: "/sos", label: "SOS" },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="shell">
      <aside className="sidebar">
        <p className="brand sidebar-brand">UniTrack Admin</p>
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
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <p className="muted small">{user?.email ?? "—"}</p>
          <button type="button" className="ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <div className="shell-body">
        <main className="shell-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
