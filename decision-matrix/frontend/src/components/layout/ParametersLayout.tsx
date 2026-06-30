import { LandPlot, Calendar, Coins, Gauge, Mountain, Link2 } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { useProjectPathBuilder } from '../../hooks/useProjectPath';
import { SubnavTabs } from './SubnavTabs';

const TABS = [
  { suffix: '/parameters/capacity', label: 'Пропускная способность', icon: Gauge },
  { suffix: '/parameters/sand', label: 'Объём песка', icon: Mountain },
  { suffix: '/parameters/earthwork', label: 'Земляные работы', icon: LandPlot },
  { suffix: '/parameters/footprint-connections', label: 'Точки подключения', icon: Link2 },
  { suffix: '/parameters/entry-dates', label: 'Дата ввода', icon: Calendar },
  { suffix: '/parameters/rates', label: 'Ставки', icon: Coins },
] as const;

export function ParametersLayout() {
  const buildPath = useProjectPathBuilder();

  return (
    <div className="parameters-layout">
      <SubnavTabs
        ariaLabel="Разделы параметров"
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
      <Outlet />
    </div>
  );
}
