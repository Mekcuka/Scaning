import { NavLink, Outlet } from 'react-router-dom';
import { Coins, Gauge } from 'lucide-react';

const TABS = [
  { to: '/parameters/capacity', label: 'Пропускная способность', icon: Gauge },
  { to: '/parameters/rates', label: 'Ставки', icon: Coins },
] as const;

export function ParametersLayout() {
  return (
    <div className="parameters-layout">
      <header className="parameters-layout__head">
        <h1 className="parameters-layout__title">Параметры</h1>
        <p className="parameters-layout__subtitle">Пропускная способность объектов и ставки стоимости проекта</p>
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
