interface Option {
  value: string;
  label: string;
}

interface EngBadgeGroupProps {
  label: string;
  badgeClass: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export function EngBadgeGroup({
  label,
  badgeClass,
  options,
  value,
  onChange,
  readOnly,
}: EngBadgeGroupProps) {
  return (
    <div>
      <small className="block mb-1 font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </small>
      <div className="flex flex-wrap gap-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={readOnly}
            className={`eng-badge ${value === opt.value ? `active-${badgeClass}` : ''}`}
            onClick={() => !readOnly && onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
