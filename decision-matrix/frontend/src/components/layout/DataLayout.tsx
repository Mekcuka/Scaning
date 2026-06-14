import { NavLink, Outlet } from 'react-router-dom';
import { Box, Download, Upload } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { useActiveProject } from '../../hooks/useActiveProject';
import { useProjectPathBuilder } from '../../hooks/useProjectPath';
import { canSeeNav } from '../../lib/permissions';
import { useAuthStore } from '../../store';

const TABS = [
  { suffix: '/data/import', label: 'Импорт', icon: Upload, permissionPath: '/data/import' },
  { suffix: '/data/export', label: 'Экспорт', icon: Download, permissionPath: '/data/export' },
  { suffix: '/data/import-3d', label: 'Импорт 3D', icon: Box, permissionPath: '/data/import-3d' },
] as const;

export function DataLayout() {
  const { role } = usePermissions();
  const user = useAuthStore((s) => s.user);
  const { activeProject } = useActiveProject();
  const buildPath = useProjectPathBuilder();
  const navCtx = { userId: user?.id, activeProject };
  const visibleTabs = TABS.filter((tab) => canSeeNav(role, tab.permissionPath, navCtx));

  return (
    <div className="parameters-layout">
      {visibleTabs.length > 0 && (
        <nav className="parameters-subnav" aria-label="Разделы данных">
          {visibleTabs.map(({ suffix, label, icon: Icon }) => (
            <NavLink
              key={suffix}
              to={buildPath(suffix)}
              className={({ isActive }) =>
                `parameters-subnav__tab${isActive ? ' parameters-subnav__tab--active' : ''}`
              }
            >
              <Icon size={16} aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
      )}
      <Outlet />
    </div>
  );
}
