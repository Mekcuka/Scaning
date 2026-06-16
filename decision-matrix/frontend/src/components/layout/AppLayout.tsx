import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Map,
  FolderOpen,
  Grid3X3,
  FileText,
  GitBranch,
  Shield,
  LogOut,
  Moon,
  Sun,
  Menu,
  SlidersHorizontal,
  Layers,
  Database,
} from 'lucide-react';
import { useAuthStore, useAppStore } from '../../store';
import { usePermissions } from '../../hooks/usePermissions';
import { canSeeNav, ROLE_LABELS } from '../../lib/permissions';
import { useActiveProject } from '../../hooks/useActiveProject';
import { useProjectPathBuilder } from '../../hooks/useProjectPath';
import { stripProjectPrefix } from '../../lib/projectRoutes';
import { APP_LOGO_MARK, APP_NAME } from '../../lib/branding';
import {
  navLinkTargetForSection,
  pathBelongsToSection,
  rememberSectionFromPath,
  type NavSection,
} from '../../lib/sectionNavMemory';
import { ToastStack } from '../ToastStack';
import { ReadOnlyBanner } from '../ReadOnlyBanner';
import { AssistantPanel } from '../assistant/AssistantPanel';
import { ProjectJobSync } from '../ProjectJobSync';
import { TaskLogPanel } from '../TaskLogPanel';
import { PageHeaderOutlet, PageHeaderProvider } from './pageHeaderContext';

type NavItem = {
  label: string;
  icon: typeof LayoutDashboard;
  end: boolean;
  permissionPath: string;
  to?: string;
  section?: NavSection;
};

const NAV: NavItem[] = [
  { to: '/', permissionPath: '/', icon: LayoutDashboard, label: 'Дашборд', end: true },
  { to: '/projects', permissionPath: '/projects', icon: FolderOpen, label: 'Проекты', end: true },
  { to: '/map', permissionPath: '/map', icon: Map, label: 'Карта', end: true },
  {
    section: 'pad-clustering',
    permissionPath: '/pad-clustering',
    icon: Layers,
    label: 'Кустование',
    end: true,
  },
  {
    section: 'parameters',
    permissionPath: '/parameters',
    icon: SlidersHorizontal,
    label: 'Параметры',
    end: true,
  },
  { section: 'flows', permissionPath: '/flows', icon: GitBranch, label: 'Потоки', end: true },
  { to: '/matrix', permissionPath: '/matrix', icon: Grid3X3, label: 'Матрица', end: true },
  { to: '/report', permissionPath: '/report', icon: FileText, label: 'Отчёты', end: true },
  {
    section: 'data',
    permissionPath: '/data',
    icon: Database,
    label: 'Данные',
    end: true,
  },
  {
    section: 'admin',
    permissionPath: '/admin',
    icon: Shield,
    label: 'Администрирование',
    end: true,
  },
];

function navItemTarget(
  item: NavItem,
  projectPath: (suffix: string) => string,
  projectId?: string | null,
): string {
  if (item.section) return navLinkTargetForSection(item.section, projectId);
  const logical = item.to ?? '/';
  if (logical === '/projects') return '/projects';
  return projectPath(logical);
}

export function AppLayout() {
  const { user, logout } = useAuthStore();
  const { role } = usePermissions();
  const { theme, toggleTheme, toasts, dismissToast } = useAppStore();
  const { projectId, activeProject } = useActiveProject();
  const buildProjectPath = useProjectPathBuilder();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const logicalPath = stripProjectPrefix(pathname);
  const [navOpen, setNavOpen] = useState(false);

  const isMapPage = logicalPath === '/map';
  const isPadClusteringWorkspace = logicalPath.startsWith('/pad-clustering/workspace');
  const isFullHeightPage = isMapPage || isPadClusteringWorkspace;

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    rememberSectionFromPath(pathname);
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

  const visibleNav = NAV.filter((item) =>
    canSeeNav(role, item.permissionPath, { userId: user?.id, activeProject }),
  );

  const closeNav = () => setNavOpen(false);

  return (
    <PageHeaderProvider>
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
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
            {APP_LOGO_MARK}
          </div>
          <div className="font-semibold text-white text-sm">{APP_NAME}</div>
        </div>
        <nav className="flex-1 min-h-0 overflow-y-auto py-3">
          {visibleNav.map((item) => {
            const { icon: Icon, label, end } = item;
            const target = navItemTarget(item, buildProjectPath, projectId);
            return (
            <NavLink
              key={label}
              to={target}
              end={end}
              onClick={closeNav}
              className={({ isActive }) => {
                const active = item.section
                  ? pathBelongsToSection(pathname, item.section)
                  : isActive;
                return `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  active ? 'bg-white/10 text-white' : 'hover:bg-white/5'
                }`;
              }}
            >
              <Icon size={18} />
              {label}
            </NavLink>
            );
          })}
        </nav>
        <div className="app-sidebar-footer shrink-0 border-t border-white/10">
          <div className="app-sidebar-user flex items-center gap-3 px-4 py-3">
            <div className="app-sidebar-user__avatar w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs text-white font-medium shrink-0">
              {user?.username?.slice(0, 2).toUpperCase() || '??'}
            </div>
            <div className="app-sidebar-user__meta flex-1 min-w-0">
              <div className="text-sm text-white truncate">{user?.username}</div>
              <div className="text-xs opacity-60 truncate">{ROLE_LABELS[role] ?? user?.role}</div>
            </div>
          </div>
          <button
            type="button"
            className="app-sidebar-logout w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
            onClick={handleLogout}
          >
            <LogOut size={18} aria-hidden />
            Выход
          </button>
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
          <PageHeaderOutlet />
          <div className="app-header-toolbar">
            <div className="app-header-actions">
              <ProjectJobSync projectId={projectId ?? null} />
              <AssistantPanel />
              <TaskLogPanel projectId={projectId ?? null} />
              <button type="button" className="btn btn-ghost p-2 shrink-0" onClick={toggleTheme} title="Тема">
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
            </div>
          </div>
        </header>
        <ReadOnlyBanner />
        <main
          className={
            isFullHeightPage
              ? 'app-main app-main--map flex flex-1 min-h-0 flex-col overflow-hidden p-6'
              : 'app-main flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6'
          }
          style={{ background: 'var(--bg)' }}
        >
          <Outlet />
        </main>
      </div>
    </div>
    </PageHeaderProvider>
  );
}
