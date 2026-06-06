import type { ReactNode } from 'react';

export function Import3dPanel({
  step,
  icon,
  title,
  subtitle,
  className = '',
  children,
}: {
  step?: number;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`card import-3d-panel card--flush ${className}`.trim()}>
      <div className="card-header import-3d-panel__header">
        <div className="import-3d-panel__title-wrap">
          {step != null ? <span className="import-3d-step">{step}</span> : null}
          <span className="import-3d-panel__icon" aria-hidden>
            {icon}
          </span>
          <div className="import-3d-panel__titles">
            <h2>{title}</h2>
            {subtitle ? <p className="import-3d-panel__subtitle">{subtitle}</p> : null}
          </div>
        </div>
      </div>
      <div className="import-3d-panel__body">{children}</div>
    </section>
  );
}
