import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import Overview from './pages/Overview';
import Monitors from './pages/Monitors';
import MonitorDetail from './pages/MonitorDetail';
import Incidents from './pages/Incidents';
import Settings from './pages/Settings';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen">Loading...</div>;
  return user ? children : <Navigate to="/login" replace />;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen">Loading...</div>;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><Auth mode="login" /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Auth mode="register" /></GuestOnly>} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/" element={<Overview />} />
        <Route path="/monitors" element={<Monitors />} />
        <Route path="/monitors/:id" element={<MonitorDetail />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}