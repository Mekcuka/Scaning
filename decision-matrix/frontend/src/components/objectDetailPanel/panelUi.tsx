import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function PanelSection({
  title,
  children,
  card = false,
  hideTitle = false,
}: {
  title: string;
  children: ReactNode;
  card?: boolean;
  hideTitle?: boolean;
}) {
  return (
    <section
      className={`object-detail-panel__section${card ? ' object-detail-panel__section--card' : ''}`}
    >
      {!hideTitle && <h3 className="object-detail-panel__section-title">{title}</h3>}
      <div className="object-detail-panel__section-body">{children}</div>
    </section>
  );
}

export function PanelSubsection({
  title,
  children,
  action,
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="object-detail-panel__subsection object-detail-panel__subsection--compact">
      {(title || action) && (
        <div className="object-detail-panel__subsection-head">
          {title && <h4 className="object-detail-panel__subsection-title">{title}</h4>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function FieldLabel({
  children,
  unit,
}: {
  children: ReactNode;
  unit?: string;
}) {
  return (
    <span className="object-detail-panel__label">
      <span className="object-detail-panel__label-text">{children}</span>
      {unit && <span className="object-detail-panel__label-unit">{unit}</span>}
    </span>
  );
}

export function PanelSwitch({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="object-detail-panel__toggle-row">
      <div className="object-detail-panel__toggle-text">
        <span className="object-detail-panel__toggle-label">{label}</span>
        {description && <p className="object-detail-panel__hint">{description}</p>}
      </div>
      <label
        className={`map-layers-switch object-detail-panel__toggle-switch${
          disabled ? ' map-layers-switch--disabled' : ''
        }`}
      >
        <input
          type="checkbox"
          className="map-layers-switch-input"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="map-layers-switch-track" aria-hidden />
      </label>
    </div>
  );
}

export function FluidToggle({
  value,
  readOnly,
  onChange,
}: {
  value: 'oil' | 'gas';
  readOnly?: boolean;
  onChange: (v: 'oil' | 'gas') => void;
}) {
  const options = [
    { value: 'oil' as const, label: 'Нефть' },
    { value: 'gas' as const, label: 'Газ' },
  ];
  if (readOnly) {
    return (
      <ReadOnlyValue>
        {options.find((o) => o.value === value)?.label ?? value}
      </ReadOnlyValue>
    );
  }
  return (
    <div className="object-detail-panel__fluid-toggle" role="group" aria-label="Тип флюида">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`object-detail-panel__fluid-btn${
            value === opt.value ? ' object-detail-panel__fluid-btn--active' : ''
          }`}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function ReadOnlyValue({
  children,
  mono,
  placeholder = '—',
}: {
  children: ReactNode;
  mono?: boolean;
  placeholder?: string;
}) {
  const empty =
    children === null ||
    children === undefined ||
    (typeof children === 'string' && children.trim() === '');
  return (
    <span
      className={`object-detail-panel__value${mono ? ' object-detail-panel__value--mono' : ''}${
        empty ? ' object-detail-panel__value--empty' : ''
      }`}
    >
      {empty ? placeholder : children}
    </span>
  );
}

export function StatChip({ children }: { children: ReactNode }) {
  return <span className="object-detail-panel__stat-chip">{children}</span>;
}

export function DetailPanelTabs<T extends string>({
  tabs,
  active,
  onChange,
  tabDirty,
  ariaLabel,
  showLabels = true,
}: {
  tabs: { id: T; label: string; icon: LucideIcon }[];
  active: T;
  onChange: (id: T) => void;
  tabDirty?: (id: T) => boolean;
  ariaLabel: string;
  showLabels?: boolean;
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
            className={`object-detail-panel__tab${
              showLabels ? ' object-detail-panel__tab--labeled' : ''
            }${isActive ? ' object-detail-panel__tab--active' : ''}${
              dirty ? ' object-detail-panel__tab--dirty' : ''
            }`}
            onClick={() => onChange(tab.id)}
          >
            <Icon size={15} strokeWidth={2} aria-hidden />
            {showLabels && <span className="object-detail-panel__tab-label">{tab.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
