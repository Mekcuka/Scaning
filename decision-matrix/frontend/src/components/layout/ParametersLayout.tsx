import { NavLink, Outlet } from 'react-router-dom';
import { LandPlot, Calendar, Coins, Gauge, Mountain, Link2 } from 'lucide-react';

const TABS = [
  { to: '/parameters/capacity', label: 'Пропускная способность', icon: Gauge },
  { to: '/parameters/sand', label: 'Объём песка', icon: Mountain },
  { to: '/parameters/earthwork', label: 'Земляные работы', icon: LandPlot },
  { to: '/parameters/footprint-connections', label: 'Точки подключения', icon: Link2 },
  { to: '/parameters/entry-dates', label: 'Дата ввода', icon: Calendar },
  { to: '/parameters/rates', label: 'Ставки', icon: Coins },
] as const;

export function ParametersLayout() {
  return (
    <div className="parameters-layout">
      <header className="parameters-layout__head">
        <h1 className="parameters-layout__title">Параметры</h1>
        <p className="parameters-layout__subtitle">
          Пропускная способность, земляные работы, точки подключения, объёмы песка, даты ввода и ставки по POI
        </p>
      </header>
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
