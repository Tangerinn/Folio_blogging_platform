import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api, isMock } from '../services/api/index.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../state/AuthContext.jsx';
import { useNotifications } from '../state/NotificationsContext.jsx';
import { LeafMark } from '../components/common/BotanicalArt.jsx';
import { Avatar, BotanicalDivider, Button } from '../components/common/ui.jsx';

const railLink = ({ isActive }) =>
  `flex items-center gap-3 rounded-btn px-3.5 py-2.5 text-sm font-medium transition ${
    isActive
      ? 'bg-secondary-container text-primary'
      : 'text-on-surface-variant hover:bg-surface-container hover:text-pine'
  }`;

function NavIcons({ name }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  switch (name) {
    case 'home':
      return <svg {...common}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;
    case 'explore':
      return <svg {...common}><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></svg>;
    case 'posts':
      return <svg {...common}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>;
    case 'saved':
      return <svg {...common}><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>;
    case 'profile':
      return <svg {...common}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
    case 'admin':
      return <svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
    default:
      return null;
  }
}

function RailContent({ user, isAdmin, categories, onNavigate }) {
  return (
    <div className="flex h-full flex-col justify-between py-6">
      <div className="space-y-6">
        <nav aria-label="Primary" className="space-y-1 px-3">
          <NavLink end to="/" className={railLink} onClick={onNavigate}>
            <NavIcons name="home" /><span>Home</span>
          </NavLink>
          <NavLink to="/explore" className={railLink} onClick={onNavigate}>
            <NavIcons name="explore" /><span>Explore</span>
          </NavLink>
          {user && (
            <>
              <NavLink to="/my-posts" className={railLink} onClick={onNavigate}>
                <NavIcons name="posts" /><span>My posts</span>
              </NavLink>
              <NavLink to="/saved" className={railLink} onClick={onNavigate}>
                <NavIcons name="saved" /><span>Saved</span>
              </NavLink>
              <NavLink to="/profile" className={railLink} onClick={onNavigate}>
                <NavIcons name="profile" /><span>Profile</span>
              </NavLink>
            </>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={railLink} onClick={onNavigate}>
              <NavIcons name="admin" /><span>Admin</span>
            </NavLink>
          )}
        </nav>

        {categories && categories.length > 0 && (
          <div className="border-t border-outline-variant/50 px-5 pt-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Topics
            </p>
            <ul className="space-y-1.5">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/explore?category=${c.id}`}
                    onClick={onNavigate}
                    className="flex items-center justify-between rounded-field px-2 py-1 text-sm text-on-surface-variant transition hover:bg-surface-container hover:text-pine"
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="text-xs text-outline">{c.postCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="px-5 pt-6">
        <div className="rounded-panel border border-sage/30 bg-sage/10 p-4 text-xs text-on-surface-variant">
          <p className="font-semibold text-pine">Sylvan Folio</p>
          <p className="mt-1 leading-relaxed">A calm space for student essays, notes, and discussion.</p>
        </div>
      </div>
    </div>
  );
}

export default function StudentLayout() {
  const { user, logout, isAdmin } = useAuth();
  const { unread } = useNotifications();
  const cats = useAsync(() => api.listCategories(), []);
  const location = useLocation();
  const navigate = useNavigate();

  const isFocusedPage = /^\/(posts\/|write|login|register)/.test(location.pathname);
  const [desktopRail, setDesktopRail] = useState(!isFocusedPage);
  const [mobileDrawer, setMobileDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const [headerQuery, setHeaderQuery] = useState('');
  const menuRef = useRef(null);
  const mobileOpenBtnRef = useRef(null);
  const mobileCloseBtnRef = useRef(null);
  const mobileFocusFrameRef = useRef(null);

  // Sync header search input when on /explore
  useEffect(() => {
    if (location.pathname === '/explore') {
      const q = new URLSearchParams(location.search).get('q') || '';
      setHeaderQuery(q);
    }
  }, [location.pathname, location.search]);

  // Collapse desktop rail automatically when entering focused views, restore on discovery views
  useEffect(() => {
    setDesktopRail(!isFocusedPage);
  }, [isFocusedPage]);

  // Close transient overlays on route or query changes
  useEffect(() => {
    setMobileDrawer(false);
    setMenu(false);
  }, [location.pathname, location.search]);

  useEffect(() => () => {
    if (mobileFocusFrameRef.current) cancelAnimationFrame(mobileFocusFrameRef.current);
  }, []);

  const openMobileDrawer = () => {
    setMobileDrawer(true);
    if (mobileFocusFrameRef.current) cancelAnimationFrame(mobileFocusFrameRef.current);
    mobileFocusFrameRef.current = requestAnimationFrame(() => {
      mobileCloseBtnRef.current?.focus({ preventScroll: true });
    });
  };

  const closeMobileDrawer = ({ restoreFocus = true } = {}) => {
    setMobileDrawer(false);
    if (mobileFocusFrameRef.current) cancelAnimationFrame(mobileFocusFrameRef.current);
    if (restoreFocus) {
      mobileFocusFrameRef.current = requestAnimationFrame(() => {
        mobileOpenBtnRef.current?.focus({ preventScroll: true });
      });
    }
  };

  useEffect(() => {
    if (!menu && !mobileDrawer) return;
    const onPointerDown = (e) => {
      if (menu && menuRef.current && !menuRef.current.contains(e.target)) setMenu(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMenu(false);
        if (mobileDrawer) closeMobileDrawer({ restoreFocus: true });
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menu, mobileDrawer]);

  const submitHeaderSearch = (e) => {
    e.preventDefault();
    const q = headerQuery.trim();
    navigate(q ? `/explore?q=${encodeURIComponent(q)}` : '/explore');
  };

  const out = async () => {
    setMenu(false);
    setMobileDrawer(false);
    await logout();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <header className="sticky top-0 z-40 border-b border-outline-variant/50 bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1360px] items-center gap-3 px-4 md:px-8">
          {/* Desktop rail toggle */}
          <button
            type="button"
            onClick={() => setDesktopRail((v) => !v)}
            aria-label={desktopRail ? 'Hide navigation sidebar' : 'Show navigation sidebar'}
            aria-expanded={desktopRail}
            aria-controls="desktop-nav-rail"
            className="hidden rounded-field p-2 text-on-surface-variant transition hover:bg-surface-container hover:text-pine xl:inline-flex focus:outline-none focus-visible:ring-2 focus-visible:ring-moss"
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Mobile/tablet drawer toggle */}
          <button
            ref={mobileOpenBtnRef}
            type="button"
            onClick={() => (mobileDrawer ? closeMobileDrawer({ restoreFocus: true }) : openMobileDrawer())}
            aria-label={mobileDrawer ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileDrawer}
            aria-controls="mobile-nav-drawer"
            className="inline-flex rounded-field p-2 text-on-surface-variant transition hover:bg-surface-container hover:text-pine xl:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-moss"
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <Link to="/" className="inline-flex items-center gap-2 font-display text-2xl font-bold tracking-[-0.02em] text-pine">
            <LeafMark className="text-moss" />
            <span>Folio</span>
          </Link>

          {/* Medium-style inline header search */}
          <search className="ml-2 hidden flex-1 max-w-xs md:block">
            <form onSubmit={submitHeaderSearch} className="relative">
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-outline"
              >
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="search"
                name="q"
                aria-label="Search Folio"
                placeholder="Search"
                enterKeyHint="search"
                value={headerQuery}
                onChange={(e) => setHeaderQuery(e.target.value)}
                className="w-full rounded-full border border-sage/35 bg-surface-container py-2 pl-10 pr-4 text-sm text-on-surface placeholder:text-outline transition focus:border-moss focus:bg-surface focus:outline-none focus:ring-2 focus:ring-moonlit-sage"
              />
            </form>
          </search>

          {/* Compact nav links when desktop rail is hidden (on md/lg or focused pages) */}
          <nav aria-label="Quick links" className={`ml-2 hidden items-center gap-1 sm:flex ${desktopRail ? 'xl:hidden' : ''}`}>
            <NavLink to="/explore" className={({ isActive }) => `rounded-btn px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-secondary-container text-primary' : 'text-on-surface-variant hover:text-pine'}`}>
              Explore
            </NavLink>
            {user && (
              <>
                <NavLink to="/my-posts" className={({ isActive }) => `hidden md:inline-block rounded-btn px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-secondary-container text-primary' : 'text-on-surface-variant hover:text-pine'}`}>
                  My posts
                </NavLink>
                <NavLink to="/saved" className={({ isActive }) => `hidden md:inline-block rounded-btn px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-secondary-container text-primary' : 'text-on-surface-variant hover:text-pine'}`}>
                  Saved
                </NavLink>
              </>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {user ? (
              <>
                <Link
                  to="/write"
                  className="inline-flex items-center gap-1.5 rounded-full border border-pine/25 bg-moss px-4 py-2 text-sm font-semibold text-parchment transition hover:bg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-moss"
                >
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  <span>Write</span>
                </Link>

                <Link
                  to="/notifications"
                  aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
                  className="relative rounded-full p-2 text-on-surface-variant transition hover:bg-surface-container hover:text-pine focus:outline-none focus-visible:ring-2 focus-visible:ring-moss"
                >
                  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                  </svg>
                  {unread > 0 && (
                    <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-moss px-1 text-[10px] font-semibold text-parchment">
                      {unread}
                    </span>
                  )}
                </Link>

                <div ref={menuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setMenu((m) => !m)}
                    aria-label="Account menu"
                    aria-expanded={menu}
                    aria-haspopup="true"
                    className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-moss focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  >
                    <Avatar name={user.name} />
                  </button>
                  {menu && (
                    <div className="absolute right-0 mt-2 w-56 rounded-panel border border-outline-variant/60 bg-surface-low p-2">
                      <div className="border-b border-outline-variant/40 px-3 py-2">
                        <p className="truncate text-sm font-semibold text-pine">{user.name}</p>
                        <p className="truncate text-xs text-on-surface-variant">{user.email}</p>
                      </div>
                      <div className="mt-1 space-y-0.5" onClick={() => setMenu(false)}>
                        <Link className="block rounded-field px-3 py-2 text-sm text-on-surface hover:bg-surface-container" to="/profile">Profile</Link>
                        <Link className="block rounded-field px-3 py-2 text-sm text-on-surface hover:bg-surface-container" to="/my-posts">My posts</Link>
                        <Link className="block rounded-field px-3 py-2 text-sm text-on-surface hover:bg-surface-container" to="/saved">Saved</Link>
                        {isAdmin && (
                          <Link className="block rounded-field px-3 py-2 text-sm font-medium text-moss hover:bg-surface-container" to="/admin">
                            Admin panel
                          </Link>
                        )}
                        <button type="button" onClick={out} className="block w-full rounded-field px-3 py-2 text-left text-sm text-on-surface hover:bg-surface-container">
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login"><Button variant="ghost" className="!px-3.5 !py-2">Sign in</Button></Link>
                <Link to="/register"><Button className="!rounded-full !px-4 !py-2">Join Folio</Button></Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Mobile slide-over navigation drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        aria-hidden={!mobileDrawer}
        inert={mobileDrawer ? undefined : ''}
        className={`fixed inset-0 z-50 flex xl:hidden transition-[visibility] duration-300 motion-reduce:transition-none ${
          mobileDrawer ? 'visible' : 'invisible pointer-events-none delay-300 motion-reduce:delay-0'
        }`}
      >
        <div
          className={`fixed inset-0 overscroll-contain bg-pine/35 backdrop-blur-[1px] transition-opacity duration-300 ease-folio motion-reduce:transition-none ${
            mobileDrawer ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden="true"
          onClick={() => closeMobileDrawer({ restoreFocus: true })}
        />
        <div
          id="mobile-nav-drawer"
          className={`relative z-10 flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto overscroll-contain border-r border-outline-variant/60 bg-surface will-change-transform transition-transform duration-300 ease-folio motion-reduce:transition-none ${
            mobileDrawer ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-16 items-center justify-between border-b border-outline-variant/50 px-5">
            <Link
              to="/"
              onClick={() => closeMobileDrawer({ restoreFocus: false })}
              className="inline-flex items-center gap-2 font-display text-2xl font-bold text-pine"
            >
              <LeafMark className="text-moss" /><span>Folio</span>
            </Link>
            <button
              ref={mobileCloseBtnRef}
              type="button"
              aria-label="Close navigation menu"
              onClick={() => closeMobileDrawer({ restoreFocus: true })}
              className="rounded-field p-2 text-on-surface-variant hover:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-moss"
            >
              ✕
            </button>
          </div>
          <div className="flex-1">
            <RailContent
              user={user}
              isAdmin={isAdmin}
              categories={cats.data}
              onNavigate={() => closeMobileDrawer({ restoreFocus: false })}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1360px] flex-1">
        <aside
          id="desktop-nav-rail"
          aria-label="Sidebar navigation"
          aria-hidden={!desktopRail}
          inert={desktopRail ? undefined : ''}
          className={`hidden shrink-0 overflow-x-clip transition-[width,opacity] duration-300 ease-folio motion-reduce:transition-none xl:block ${
            desktopRail ? 'w-56 opacity-100' : 'w-0 opacity-0 pointer-events-none'
          }`}
        >
          <div
            className={`sticky top-16 h-[calc(100vh-4rem)] w-56 overflow-y-auto border-r border-outline-variant/50 will-change-transform transition-transform duration-300 ease-folio motion-reduce:transition-none ${
              desktopRail ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <RailContent user={user} isAdmin={isAdmin} categories={cats.data} />
          </div>
        </aside>

        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
          <Outlet />
        </main>
      </div>

      <footer className="border-t border-outline-variant/40 py-8">
        <BotanicalDivider />
        <p className="mt-3 text-center text-sm text-on-surface-variant">
          Folio — student writing and discussion{isMock && ' · demo data'}
        </p>
      </footer>
    </div>
  );
}
