import { Mountain, Truck } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { useProjectPathBuilder } from '../../hooks/useProjectPath';
import { SubnavTabs } from './SubnavTabs';

const TABS = [
  { suffix: '/logistics/schematic', label: 'Логистика', icon: Truck },
  { suffix: '/logistics/sand', label: 'Объём песка', icon: Mountain },
] as const;

export function LogisticsLayout() {
  const buildPath = useProjectPathBuilder();

  return (
    <div className="parameters-layout">
      <SubnavTabs
        ariaLabel="Разделы логистики"
        tabs={TABS.map(({ suffix, label, icon: Icon }) => ({
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
