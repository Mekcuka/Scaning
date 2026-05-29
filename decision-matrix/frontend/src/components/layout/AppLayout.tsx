import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import {
  LayoutDashboard,
  Map,
  Upload,
  FolderOpen,
  Coins,
  Grid3X3,
  BarChart3,
  FileText,
  GitBranch,
  LogOut,
  Moon,
  Sun,
  Layers,
} from 'lucide-react';
import { useAuthStore, useAppStore } from '../../store';
import { useActiveProject } from '../../hooks/useActiveProject';
import { AppSelect } from '../AppSelect';
import { ToastStack } from '../ToastStack';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Дашборд' },
  { to: '/projects', icon: FolderOpen, label: 'Проекты' },
  { to: '/map', icon: Map, label: 'Карта' },
  { to: '/flows', icon: GitBranch, label: 'Потоки' },
  { to: '/matrix', icon: Grid3X3, label: 'Матрица' },
  { to: '/report', icon: FileText, label: 'Отчёты' },
  { to: '/rates', icon: Coins, label: 'Ставки' },
  { to: '/ranking', icon: BarChart3, label: 'Ранжирование' },
  { to: '/import', icon: Upload, label: 'Импорт' },
];

export type DashboardOutletContext = {
  projectSearch: string;
};

export function useDashboardOutlet(): DashboardOutletContext {
  return useOutletContext<DashboardOutletContext>() ?? { projectSearch: '' };
}

export function AppLayout() {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme, toasts, dismissToast } = useAppStore();
  const { projects, projectId, setProjectId, hasProjects } = useActiveProject();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [projectSearch, setProjectSearch] = useState('');

  const isDashboard = pathname === '/';
  const isMapPage = pathname === '/map';
  const isProjectsPage = pathname === '/projects';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen max-h-screen overflow-hidden">
      <ToastStack toasts={toasts} onDismiss={dismissToast} position="bottom" />
      <aside
        className="w-56 h-screen max-h-screen flex flex-col shrink-0 overflow-hidden"
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
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
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
            <div className="text-xs opacity-60 capitalize">{user?.role}</div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0 h-screen overflow-hidden">
        <header
          className="h-14 flex items-center gap-4 px-6 border-b shrink-0"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}
        >
          <div className="flex flex-1 items-center justify-end gap-4 min-w-0">
            {(isDashboard || isProjectsPage) && (
              <input
                type="search"
                className="topbar-search"
                placeholder="Поиск проектов..."
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                aria-label="Поиск проектов"
              />
            )}
            {!isDashboard && !isProjectsPage && hasProjects && (
              <label className="flex items-center gap-2 text-sm shrink-0">
                <span style={{ color: 'var(--text-muted)' }}>Проект:</span>
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
              <LogOut size={16} /> Выход
            </button>
          </div>
        </header>
        <main
          className={
            isMapPage
              ? 'flex flex-1 min-h-0 flex-col overflow-hidden p-6'
              : 'flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6'
          }
          style={{ background: 'var(--bg)' }}
        >
          <Outlet context={{ projectSearch } satisfies DashboardOutletContext} />
        </main>
      </div>
    </div>
  );
}
