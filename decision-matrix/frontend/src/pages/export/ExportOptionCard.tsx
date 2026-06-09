import type { ReactNode } from 'react';

type FormatTag = 'xlsx' | 'csv' | 'geojson';

const FORMAT_LABELS: Record<FormatTag, string> = {
  xlsx: 'Excel',
  csv: 'CSV',
  geojson: 'GeoJSON',
};

type Props = {
  icon: ReactNode;
  accent: 'blue' | 'green' | 'violet';
  title: string;
  description: string;
  countLabel: string;
  emptyHint?: string;
  formats: FormatTag[];
  disabled: boolean;
  children: ReactNode;
};

export function ExportOptionCard({
  icon,
  accent,
  title,
  description,
  countLabel,
  emptyHint,
  formats,
  disabled,
  children,
}: Props) {
  return (
    <section
      className={`export-option card export-option--${accent}${disabled ? ' export-option--disabled' : ''}`}
    >
      <div className="export-option__head">
        <span className="export-option__icon" aria-hidden>
          {icon}
        </span>
        <div className="export-option__meta">
          <h3 className="export-option__title">{title}</h3>
          <p className="export-option__desc">{description}</p>
        </div>
      </div>

      <div className="export-option__status">
        <span className="export-option__count">{countLabel}</span>
        <div className="export-option__formats">
          {formats.map((format) => (
            <span key={format} className="export-option__format">
              {FORMAT_LABELS[format]}
            </span>
          ))}
        </div>
      </div>

      {disabled && emptyHint ? (
        <p className="export-option__empty">{emptyHint}</p>
      ) : null}

      <div className="export-option__actions">{children}</div>
    </section>
  );
}
