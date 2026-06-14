import { NavLink, Outlet } from 'react-router-dom';

import { Box, Download, Upload } from 'lucide-react';

import { usePermissions } from '../../hooks/usePermissions';

import { useActiveProject } from '../../hooks/useActiveProject';

import { canSeeNav } from '../../lib/permissions';

import { useAuthStore } from '../../store';



const TABS = [

  { to: 'import', label: 'Импорт', icon: Upload, permissionPath: '/data/import' },

  { to: 'export', label: 'Экспорт', icon: Download, permissionPath: '/data/export' },

  { to: 'import-3d', label: 'Импорт 3D', icon: Box, permissionPath: '/data/import-3d' },

] as const;



export function DataLayout() {

  const { role } = usePermissions();

  const user = useAuthStore((s) => s.user);

  const { activeProject } = useActiveProject();

  const navCtx = { userId: user?.id, activeProject };

  const visibleTabs = TABS.filter((tab) => canSeeNav(role, tab.permissionPath, navCtx));



  return (

    <div className="parameters-layout">

      {visibleTabs.length > 0 && (

        <nav className="parameters-subnav" aria-label="Разделы данных">

          {visibleTabs.map(({ to, label, icon: Icon }) => (

            <NavLink

              key={to}

              to={to}

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

