import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Map,
  Upload,
  Box,
  FolderOpen,
  Grid3X3,
  FileText,
  GitBranch,
  Shield,
  LogOut,
  Moon,
  Sun,
  Layers,
  Menu,
  SlidersHorizontal,
} from 'lucide-react';
import { useAuthStore, useAppStore } from '../../store';
import { usePermissions } from '../../hooks/usePermissions';
import { canSeeNav, ROLE_LABELS } from '../../lib/permissions';
import { useActiveProject } from '../../hooks/useActiveProject';
import { AppSelect } from '../AppSelect';
import { ToastStack } from '../ToastStack';
import { ReadOnlyBanner } from '../ReadOnlyBanner';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Дашборд', end: true },
  { to: '/projects', icon: FolderOpen, label: 'Проекты', end: true },
  { to: '/map', icon: Map, label: 'Карта', end: true },
  { to: '/parameters', icon: SlidersHorizontal, label: 'Параметры', end: false },
  { to: '/flows', icon: GitBranch, label: 'Потоки', end: false },
  { to: '/matrix', icon: Grid3X3, label: 'Матрица', end: true },
  { to: '/report', icon: FileText, label: 'Отчёты', end: true },
  { to: '/import', icon: Upload, label: 'Импорт', end: true },
  { to: '/import-3d', icon: Box, label: 'Импорт 3D', end: true },
  { to: '/admin', icon: Shield, label: 'Администрирование', end: false },
] as const;

export function AppLayout() {
  const { user, logout } = useAuthStore();
  const { role } = usePermissions();
  const { theme, toggleTheme, toasts, dismissToast } = useAppStore();
  const { projects, projectId, activeProject, setProjectId, hasProjects } = useActiveProject();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  const isMapPage = pathname === '/map';

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [navOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const visibleNav = NAV.filter(({ to }) =>
    canSeeNav(role, to, { userId: user?.id, activeProject }),
  );

  const closeNav = () => setNavOpen(false);

  return (
    <div className="app-shell">
      <ToastStack toasts={toasts} onDismiss={dismissToast} position="bottom" />
      {navOpen && (
        <button
          type="button"
          className="app-sidebar-backdrop"
          aria-label="Закрыть меню"
          onClick={closeNav}
        />
      )}
      <aside
        className={`app-sidebar w-56 h-full max-h-full flex flex-col shrink-0 overflow-hidden${
          navOpen ? ' app-sidebar--open' : ''
        }`}
        style={{ background: 'var(--sidebar-bg)', color: 'var(--sidebar-text)' }}
      >
        <div className="flex items-center gap-3 p-4 border-b border-white/10 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
            <Layers size={18} className="text-white" />
          </div>
          <div>
            <div className="font-semibold text-white text-sm">СППР</div>
            <div className="text-xs opacity-70">Нефтегаз · MVP</div>
          </div>
        </div>
        <nav className="flex-1 min-h-0 overflow-y-auto py-3">
          {visibleNav.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={closeNav}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive ? 'bg-white/10 text-white' : 'hover:bg-white/5'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs text-white font-medium">
            {user?.username?.slice(0, 2).toUpperCase() || '??'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-white truncate">{user?.username}</div>
            <div className="text-xs opacity-60">{ROLE_LABELS[role] ?? user?.role}</div>
          </div>
        </div>
      </aside>

      <div className="app-content">
        <header
          className="app-header"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}
        >
          <button
            type="button"
            className="app-sidebar-toggle btn btn-ghost p-2 shrink-0"
            onClick={() => setNavOpen(true)}
            aria-label="Открыть меню"
          >
            <Menu size={20} />
          </button>
          <div className="app-header-toolbar">
            <div className="app-header-actions">
              {pathname !== '/' && pathname !== '/projects' && hasProjects && (
                <label className="app-header-project flex items-center gap-2 text-sm min-w-0">
                  <span className="app-header-project-label" style={{ color: 'var(--text-muted)' }}>
                    Проект:
                  </span>
                  <AppSelect
                    variant="toolbar"
                    icon={<FolderOpen size={14} aria-hidden />}
                    ariaLabel="Проект"
                    value={projectId ?? ''}
                    onChange={(id) => setProjectId(id || null)}
                    options={projects.map((p) => ({ value: p.id, label: p.name }))}
                  />
                </label>
              )}
              <button type="button" className="btn btn-ghost p-2 shrink-0" onClick={toggleTheme} title="Тема">
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={handleLogout}>
                <LogOut size={16} />
                <span className="btn-logout-label">Выход</span>
              </button>
            </div>
          </div>
        </header>
        <ReadOnlyBanner />
        <main
          className={
            isMapPage
              ? 'app-main app-main--map flex flex-1 min-h-0 flex-col overflow-hidden p-6'
              : 'app-main flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6'
          }
          style={{ background: 'var(--bg)' }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
