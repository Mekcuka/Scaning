import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="object-detail-panel__section">
      <h3 className="object-detail-panel__section-title">{title}</h3>
      {children}
    </section>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="object-detail-panel__label">{children}</span>;
}

export function DetailPanelTabs<T extends string>({
  tabs,
  active,
  onChange,
  tabDirty,
  ariaLabel,
}: {
  tabs: { id: T; label: string; icon: LucideIcon }[];
  active: T;
  onChange: (id: T) => void;
  tabDirty?: (id: T) => boolean;
  ariaLabel: string;
}) {
  if (tabs.length <= 1) return null;

  return (
    <div className="object-detail-panel__tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        const dirty = tabDirty?.(tab.id);
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={tab.label}
            title={tab.label}
            className={`object-detail-panel__tab${isActive ? ' object-detail-panel__tab--active' : ''}${
              dirty ? ' object-detail-panel__tab--dirty' : ''
            }`}
            onClick={() => onChange(tab.id)}
          >
            <Icon size={15} strokeWidth={2} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
