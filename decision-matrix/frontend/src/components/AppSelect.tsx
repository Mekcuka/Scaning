import { Select, Space } from 'antd';
import type { SelectProps } from 'antd';

export type AppSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type AppSelectVariant = 'default' | 'sm' | 'toolbar' | 'compact';

type Props = {
  options: AppSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  variant?: AppSelectVariant;
  icon?: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  title?: string;
  menuAlign?: 'left' | 'right';
  fullWidth?: boolean;
  matchMenuWidth?: boolean;
};

function variantToSize(variant: AppSelectVariant): SelectProps['size'] {
  if (variant === 'sm' || variant === 'compact' || variant === 'toolbar') return 'small';
  return 'middle';
}

export function AppSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  readOnly = false,
  variant = 'default',
  icon,
  className = '',
  ariaLabel,
  title,
  fullWidth,
  matchMenuWidth = false,
}: Props) {
  const isDisabled = disabled || readOnly;
  const widthFull = fullWidth ?? (variant === 'default' || variant === 'compact');

  const selectEl = (
    <Select
      className={`app-select app-select--${variant} ${className}`.trim()}
      size={variantToSize(variant)}
      variant={variant === 'toolbar' ? 'borderless' : 'outlined'}
      value={value}
      onChange={(val) => {
        if (val != null && typeof val === 'object' && 'value' in val) {
          onChange(String((val as { value: string }).value));
          return;
        }
        onChange(String(val ?? ''));
      }}
      placeholder={placeholder ?? 'Выберите…'}
      disabled={isDisabled}
      options={options}
      aria-label={ariaLabel}
      title={title}
      style={widthFull ? { width: '100%', minWidth: 0 } : icon ? { minWidth: 0, flex: 1 } : undefined}
      popupMatchSelectWidth={matchMenuWidth}
      showSearch={options.length > 8}
      optionFilterProp="label"
    />
  );

  if (!icon) return selectEl;

  return (
    <Space.Compact
      className={`app-select-wrap app-select-wrap--${variant}`}
      style={widthFull ? { width: '100%', minWidth: 0 } : undefined}
    >
      <span className="app-select-icon flex items-center px-2" aria-hidden>
        {icon}
      </span>
      {selectEl}
    </Space.Compact>
  );
}

/** Build options from a string map (e.g. SUBTYPE_LABELS). */
export function selectOptionsFromRecord(record: Record<string, string>): AppSelectOption[] {
  return Object.entries(record).map(([value, label]) => ({ value, label }));
}
