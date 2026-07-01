import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Layout,
  Menu,
  Button,
  Avatar,
  Typography,
  Drawer,
  type MenuProps,
} from 'antd';
import {
  DashboardOutlined,
  FolderOpenOutlined,
  EnvironmentOutlined,
  AppstoreOutlined,
  SlidersOutlined,
  PartitionOutlined,
  TableOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  SafetyOutlined,
  TruckOutlined,
  MenuOutlined,
  MoonOutlined,
  SunOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useAuthStore, useAppStore } from '../../store';
import { usePermissions } from '../../hooks/usePermissions';
import { canSeeNav, ROLE_LABELS } from '../../lib/permissions';
import { useActiveProject } from '../../hooks/useActiveProject';
import { useProjectPathBuilder } from '../../hooks/useProjectPath';
import { projectIdFromPathname, projectPath, stripProjectPrefix } from '../../lib/projectRoutes';
import { APP_LOGO_MARK, APP_NAME } from '../../lib/branding';
import {
  navLinkTargetForSection,
  pathBelongsToSection,
  rememberSectionFromPath,
  type NavSection,
} from '../../lib/sectionNavMemory';
import { AppSelect } from '../AppSelect';
import { ReadOnlyBanner } from '../ReadOnlyBanner';
import { AssistantPanel } from '../assistant/AssistantPanel';
import { ProjectJobSync } from '../ProjectJobSync';
import { TaskLogPanel } from '../TaskLogPanel';
import { PageHeaderOutlet, PageHeaderProvider } from './pageHeaderContext';
import {
  prefetchMapPage,
  scheduleMapPageBundlePrefetch,
} from '../../routes/prefetchRoutes';

const { Sider, Header, Content } = Layout;

type NavItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  end: boolean;
  permissionPath: string;
  to?: string;
  section?: NavSection;
};

const NAV: NavItem[] = [
  { key: 'dashboard', to: '/', permissionPath: '/', icon: <DashboardOutlined />, label: 'Дашборд', end: true },
  { key: 'projects', to: '/projects', permissionPath: '/projects', icon: <FolderOpenOutlined />, label: 'Проекты', end: true },
  { key: 'map', to: '/map', permissionPath: '/map', icon: <EnvironmentOutlined />, label: 'Карта', end: true },
  {
    key: 'pad-clustering',
    section: 'pad-clustering',
    permissionPath: '/pad-clustering',
    icon: <AppstoreOutlined />,
    label: 'Кустование',
    end: true,
  },
  {
    key: 'parameters',
    section: 'parameters',
    permissionPath: '/parameters',
    icon: <SlidersOutlined />,
    label: 'Параметры',
    end: true,
  },
  {
    key: 'logistics',
    section: 'logistics',
    permissionPath: '/logistics',
    icon: <TruckOutlined />,
    label: 'Логистика',
    end: true,
  },
  { key: 'flows', section: 'flows', permissionPath: '/flows', icon: <PartitionOutlined />, label: 'Потоки', end: true },
  { key: 'matrix', to: '/matrix', permissionPath: '/matrix', icon: <TableOutlined />, label: 'Матрица', end: true },
  { key: 'report', to: '/report', permissionPath: '/report', icon: <FileTextOutlined />, label: 'Отчёты', end: true },
  {
    key: 'data',
    section: 'data',
    permissionPath: '/data',
    icon: <DatabaseOutlined />,
    label: 'Данные',
    end: true,
  },
  {
    key: 'admin',
    section: 'admin',
    permissionPath: '/admin',
    icon: <SafetyOutlined />,
    label: 'Администрирование',
    end: true,
  },
];

function navItemTarget(
  item: NavItem,
  projectPathFn: (suffix: string) => string,
  projectId?: string | null,
): string {
  if (item.section) return navLinkTargetForSection(item.section, projectId);
  const logical = item.to ?? '/';
  if (logical === '/projects') return '/projects';
  return projectPathFn(logical);
}

function navSelectedKey(pathname: string, item: NavItem): boolean {
  if (item.section) return pathBelongsToSection(pathname, item.section);
  const logical = stripProjectPrefix(pathname);
  const target = item.to ?? '/';
  if (target === '/') return logical === '/' || logical.startsWith('/dashboard');
  return logical === target || logical.startsWith(`${target}/`);
}

function SidebarBrand() {
  return (
    <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10 shrink-0">
      <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
        {APP_LOGO_MARK}
      </div>
      <Typography.Text className="!text-white font-semibold text-sm">{APP_NAME}</Typography.Text>
    </div>
  );
}

function SidebarFooter({
  username,
  roleLabel,
  onLogout,
}: {
  username?: string;
  roleLabel: string;
  onLogout: () => void;
}) {
  return (
    <div className="shrink-0 border-t border-white/10">
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar size={32} className="bg-blue-600 shrink-0">
          {username?.slice(0, 2).toUpperCase() || '??'}
        </Avatar>
        <div className="flex-1 min-w-0">
          <Typography.Text className="!text-white block truncate text-sm">{username}</Typography.Text>
          <Typography.Text className="!text-white/60 block truncate text-xs">{roleLabel}</Typography.Text>
        </div>
      </div>
      <Button
        type="text"
        className="app-sidebar-logout w-full !justify-start !rounded-none px-4 py-2.5 !h-auto min-h-[44px]"
        icon={<LogoutOutlined />}
        onClick={onLogout}
      >
        Выход
      </Button>
    </div>
  );
}

function navMenuLabel(item: NavItem, onMapPrefetch?: () => void): ReactNode {
  if (item.key !== 'map' || !onMapPrefetch) return item.label;
  return (
    <span onPointerEnter={onMapPrefetch} onFocus={onMapPrefetch}>
      {item.label}
    </span>
  );
}

export function AppLayout() {
  const { user, logout } = useAuthStore();
  const { role } = usePermissions();
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useAppStore();
  const { projectId, activeProject, projects, setProjectId, hasProjects } = useActiveProject();
  const buildProjectPath = useProjectPathBuilder();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const logicalPath = stripProjectPrefix(pathname);
  const [navOpen, setNavOpen] = useState(false);

  const isMapPage = logicalPath === '/map';
  const isPadClusteringWorkspace = logicalPath.startsWith('/pad-clustering/workspace');

  const mainContentClassName = isMapPage
    ? 'app-main app-main--map flex flex-1 min-h-0 flex-col overflow-hidden p-0'
    : isPadClusteringWorkspace
      ? 'app-main app-main--pad-clustering flex flex-1 min-h-0 flex-col overflow-hidden p-6'
      : 'app-main flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6';

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    rememberSectionFromPath(pathname);
  }, [pathname]);

  const canSeeMap = canSeeNav(role, '/map', { userId: user?.id, activeProject });

  useEffect(() => {
    if (!projectId || isMapPage || !canSeeMap) return;
    scheduleMapPageBundlePrefetch();
  }, [projectId, isMapPage, canSeeMap]);

  const handleMapPrefetch = () => {
    prefetchMapPage(queryClient, projectId);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const visibleNav = NAV.filter((item) =>
    canSeeNav(role, item.permissionPath, { userId: user?.id, activeProject }),
  );

  const selectedKey = useMemo(
    () => visibleNav.find((item) => navSelectedKey(pathname, item))?.key ?? '',
    [visibleNav, pathname],
  );

  const menuItems: MenuProps['items'] = visibleNav.map((item) => ({
    key: item.key,
    icon: item.icon,
    label: navMenuLabel(item, item.key === 'map' ? handleMapPrefetch : undefined),
  }));

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    const item = visibleNav.find((n) => n.key === key);
    if (!item) return;
    navigate(navItemTarget(item, buildProjectPath, projectId));
    setNavOpen(false);
  };

  const handleProjectChange = (id: string) => {
    if (!id) return;
    setProjectId(id);
    const urlProjectId = projectIdFromPathname(pathname);
    if (urlProjectId) {
      navigate(projectPath(id, logicalPath));
    }
  };

  const showProjectPicker =
    logicalPath !== '/' && logicalPath !== '/projects' && hasProjects;

  const sidebarMenu = (
    <>
      <SidebarBrand />
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={selectedKey ? [selectedKey] : []}
        items={menuItems}
        onClick={onMenuClick}
        style={{ flex: 1, borderInlineEnd: 0, overflow: 'auto' }}
      />
      <SidebarFooter
        username={user?.username}
        roleLabel={ROLE_LABELS[role] ?? user?.role ?? ''}
        onLogout={handleLogout}
      />
    </>
  );

  return (
    <PageHeaderProvider>
      <Layout className="app-shell" style={{ minHeight: '100vh', height: '100%' }}>
        <Sider
          width={224}
          theme="dark"
          breakpoint="lg"
          collapsedWidth={0}
          className="!hidden lg:!block"
          style={{ height: '100vh', position: 'sticky', top: 0, left: 0 }}
        >
          <div className="flex flex-col h-full">{sidebarMenu}</div>
        </Sider>

        <Drawer
          placement="left"
          open={navOpen}
          onClose={() => setNavOpen(false)}
          width={280}
          styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' } }}
          className="lg:hidden"
        >
          {sidebarMenu}
        </Drawer>

        <Layout className="app-content min-h-0 min-w-0 flex-1 flex flex-col overflow-hidden">
          <Header
            className="app-header !px-4 !py-0 flex items-center gap-3"
            style={{
              background: 'var(--surface)',
              borderBottom: '1px solid var(--border)',
              boxShadow: 'var(--shadow)',
              height: 'auto',
              lineHeight: 'normal',
              paddingTop: 8,
              paddingBottom: 8,
            }}
          >
            <Button
              type="text"
              className="lg:!hidden shrink-0"
              icon={<MenuOutlined />}
              aria-label="Открыть меню"
              onClick={() => setNavOpen(true)}
            />
            <PageHeaderOutlet />
            <div className="app-header-toolbar ml-auto flex items-center gap-2 shrink-0">
              {showProjectPicker && (
                <label className="app-header-project flex items-center gap-2 text-sm min-w-0">
                  <span className="app-header-project-label hidden sm:inline" style={{ color: 'var(--text-muted)' }}>
                    Проект:
                  </span>
                  <AppSelect
                    variant="toolbar"
                    icon={<FolderOpenOutlined />}
                    ariaLabel="Проект"
                    value={projectId ?? ''}
                    onChange={handleProjectChange}
                    options={projects.map((p) => ({
                      value: p.id,
                      label: p.name || p.id,
                    }))}
                  />
                </label>
              )}
              <ProjectJobSync projectId={projectId ?? null} />
              <AssistantPanel />
              <TaskLogPanel projectId={projectId ?? null} />
              <Button
                type="text"
                icon={theme === 'light' ? <MoonOutlined /> : <SunOutlined />}
                onClick={toggleTheme}
                title="Тема"
                aria-label="Переключить тему"
              />
            </div>
          </Header>
          <ReadOnlyBanner />
          <Content
            className={mainContentClassName}
            style={{ background: 'var(--bg)' }}
          >
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </PageHeaderProvider>
  );
}
