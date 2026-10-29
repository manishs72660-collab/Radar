import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Activity, TriangleAlert, Settings as SettingsIcon, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../auth';
import Logo from './Logo';

const links = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/monitors', label: 'Monitors', icon: Activity },
  { to: '/incidents', label: 'Incidents', icon: TriangleAlert },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);
  const navigation = (mobile = false) => (
    <nav className={mobile ? 'nav mobile-nav-links' : 'nav'} aria-label="Main">
      {links.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} onClick={mobile ? closeMenu : undefined} className={({ isActive }) => (isActive ? 'active' : '')}>
          <Icon size={18} /> {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Logo /> Radar
        </div>
        {navigation()}
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
        <header className="mobile-bar">
          <div className="brand"><Logo size={22} /> Radar</div>
          <button className="icon-btn mobile-menu-toggle" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen}>
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </header>
        {menuOpen && <div className="mobile-menu">{navigation(true)}<div className="mobile-user">{user.name} · {user.email}<button className="btn btn-sm" onClick={logout}><LogOut size={14} /> Log out</button></div></div>}
        <main className="main">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}