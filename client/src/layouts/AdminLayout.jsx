import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import { Avatar, Button } from '../components/common/ui.jsx';

const item = ({ isActive }) =>
  `block rounded-btn px-4 py-2.5 text-sm font-medium transition ${
    isActive ? 'bg-secondary-container text-primary' : 'text-on-surface-variant hover:bg-surface-container'
  }`;

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const out = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen md:flex">
      <a href="#admin-main" className="skip-link">Skip to main content</a>
      <aside className="border-b border-outline-variant/50 bg-surface-low p-5 md:w-64 md:shrink-0 md:border-b-0 md:border-r">
        <Link to="/admin" className="font-display text-2xl font-bold tracking-[-0.02em] text-pine">Folio</Link>
        <p className="mb-6 text-xs font-medium uppercase tracking-wider text-on-surface-variant">Admin</p>
        <nav aria-label="Admin" className="flex flex-wrap gap-1 md:flex-col">
          <NavLink end to="/admin" className={item}>Dashboard</NavLink>
          <NavLink to="/admin/users" className={item}>Users</NavLink>
          <NavLink to="/admin/moderation" className={item}>Moderation</NavLink>
          <NavLink to="/admin/categories" className={item}>Categories</NavLink>
        </nav>
        <div className="mt-8 hidden items-center gap-2 border-t border-outline-variant/40 pt-5 md:flex">
          <Avatar name={user?.name} size={32} />
          <span className="truncate text-sm font-medium text-pine">{user?.name}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/"><Button variant="outline" className="!px-3 !py-1.5">View site</Button></Link>
          <Button variant="ghost" className="!px-3 !py-1.5" onClick={out}>Sign out</Button>
        </div>
      </aside>
      <main id="admin-main" tabIndex={-1} className="flex-1 px-5 py-10 focus:outline-none md:px-12">
        <div className="mx-auto max-w-5xl"><Outlet /></div>
      </main>
    </div>
  );
}
