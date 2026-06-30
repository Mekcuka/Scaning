import { Card } from 'antd';
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
  formats?: FormatTag[];
  formatTags?: string[];
  disabled: boolean;
  body?: ReactNode;
  children?: ReactNode;
};

export function ExportOptionCard({
  icon,
  accent,
  title,
  description,
  countLabel,
  emptyHint,
  formats = [],
  formatTags,
  disabled,
  body,
  children,
}: Props) {
  const tags =
    formatTags ??
    formats.map((format) => FORMAT_LABELS[format]);

  return (
    <Card
      className={`export-option export-option--${accent}${disabled ? ' export-option--disabled' : ''}`}
      styles={{ body: { padding: 0 } }}
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
        {tags.length > 0 ? (
          <div className="export-option__formats">
            {tags.map((tag) => (
              <span key={tag} className="export-option__format">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {disabled && emptyHint ? (
        <p className="export-option__empty">{emptyHint}</p>
      ) : null}

      {!disabled && body ? <div className="export-option__body">{body}</div> : null}

      {!disabled && children ? (
        <div className="export-option__actions">{children}</div>
      ) : null}
    </Card>
  );
}
