import { Box, Download, Upload } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import { useActiveProject } from '../../hooks/useActiveProject';
import { useProjectPathBuilder } from '../../hooks/useProjectPath';
import { canSeeNav } from '../../lib/permissions';
import { useAuthStore } from '../../store';
import { SubnavTabs } from './SubnavTabs';

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
      <SubnavTabs
        ariaLabel="Разделы данных"
        tabs={visibleTabs.map(({ suffix, label, icon: Icon }) => ({
          key: suffix,
          to: buildPath(suffix),
          label: (
            <span className="inline-flex items-center gap-2">
              <Icon size={16} aria-hidden />
              {label}
            </span>
          ),
        }))}
      />
      <div className="parameters-layout__body">
        <Outlet />
      </div>
    </div>
  );
}
