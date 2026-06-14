import { NavLink, Outlet } from 'react-router-dom';
import { LandPlot, Calendar, Coins, Gauge, Mountain, Link2 } from 'lucide-react';
import { useProjectPathBuilder } from '../../hooks/useProjectPath';

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
      <nav className="parameters-subnav" aria-label="Разделы параметров">
        {TABS.map(({ suffix, label, icon: Icon }) => (
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
      <Outlet />
    </div>
  );
}
