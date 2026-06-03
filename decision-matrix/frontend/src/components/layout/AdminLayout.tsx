import { NavLink, Outlet } from 'react-router-dom';
import { Activity, Shield } from 'lucide-react';

const TABS = [
  { to: '/admin/users', label: 'Пользователи', icon: Shield },
  { to: '/admin/jobs', label: 'Журнал задач', icon: Activity },
] as const;

export function AdminLayout() {
  return (
    <div className="parameters-layout">
      <header className="parameters-layout__head">
        <h1 className="parameters-layout__title">Администрирование</h1>
        <p className="parameters-layout__subtitle">
          Пользователи, роли и фоновые задачи проектов
        </p>
      </header>
      <nav className="parameters-subnav" aria-label="Разделы администрирования">
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
