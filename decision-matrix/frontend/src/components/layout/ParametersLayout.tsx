import { NavLink, Outlet } from 'react-router-dom';
import { LandPlot, Calendar, Coins, Gauge, Mountain, Link2 } from 'lucide-react';

const TABS = [
  { to: 'capacity', label: 'Пропускная способность', icon: Gauge },
  { to: 'sand', label: 'Объём песка', icon: Mountain },
  { to: 'earthwork', label: 'Земляные работы', icon: LandPlot },
  { to: 'footprint-connections', label: 'Точки подключения', icon: Link2 },
  { to: 'entry-dates', label: 'Дата ввода', icon: Calendar },
  { to: 'rates', label: 'Ставки', icon: Coins },
] as const;

export function ParametersLayout() {
  return (
    <div className="parameters-layout">
      <nav className="parameters-subnav" aria-label="Разделы параметров">
        {TABS.map(({ to, label, icon: Icon }) => (
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
      <Outlet />
    </div>
  );
}
