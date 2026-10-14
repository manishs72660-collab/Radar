import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Activity, TriangleAlert, Settings as SettingsIcon, LogOut } from 'lucide-react';
import { useAuth } from '../auth';
import Logo from './Logo';

const links = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/monitors', label: 'Monitors', icon: Activity },
  { to: '/incidents', label: 'Incidents', icon: TriangleAlert },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Logo /> Radar
        </div>
        <nav className="nav" aria-label="Main">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip">
            <div className="avatar">{user.name?.[0]?.toUpperCase()}</div>
            <div>
              <div style={{ fontWeight: 600 }}>{user.name}</div>
              <small>{user.email}</small>
            </div>
          </div>
          <button className="btn btn-sm" onClick={logout}>
            <LogOut size={15} /> Log out
          </button>
        </div>
      </aside>

      <div>
        <div className="mobile-bar">
          <div className="brand" style={{ fontSize: 18 }}>
            <Logo size={22} /> Radar
          </div>
          <nav aria-label="Main">
            {links.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}