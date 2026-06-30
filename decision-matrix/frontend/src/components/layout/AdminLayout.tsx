import { Activity, Bot, Shield } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { SubnavTabs } from './SubnavTabs';

const TABS = [
  { to: '/admin/users', label: 'Пользователи', icon: Shield },
  { to: '/admin/jobs', label: 'Журнал задач', icon: Activity },
  { to: '/admin/assistant', label: 'AI-помощник', icon: Bot },
] as const;

export function AdminLayout() {
  return (
    <div className="parameters-layout">
      <SubnavTabs
        ariaLabel="Разделы администрирования"
        tabs={TABS.map(({ to, label, icon: Icon }) => ({
          key: to,
          to,
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
