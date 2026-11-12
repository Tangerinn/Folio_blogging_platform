import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import { Spinner } from '../components/common/ui.jsx';

// Frontend gating is UX only; the server enforces roles (security.md).
export default function ProtectedRoute({ role }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
}
