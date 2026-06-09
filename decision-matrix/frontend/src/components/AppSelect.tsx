import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { AnchoredMenu } from './AnchoredMenu';

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
  /** Root/trigger width matches the widest menu item (for status pills). */
  matchMenuWidth?: boolean;
};

function measureSelectMenuWidth(options: AppSelectOption[]): number {
  if (typeof document === 'undefined' || options.length === 0) return 0;

  const wrap = document.createElement('div');
  wrap.className = 'app-anchored-menu app-select-menu';
  wrap.style.cssText =
    'position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none';

  const ul = document.createElement('ul');
  ul.className = 'app-select-menu-list';

  for (const opt of options) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'app-select-option app-select-option-selected';
    const label = document.createElement('span');
    label.className = 'app-select-option-label';
    label.textContent = opt.label;
    const check = document.createElement('span');
    check.className = 'app-select-option-check';
    check.textContent = '✓';
    check.style.width = '14px';
    check.style.flexShrink = '0';
    btn.append(label, check);
    li.appendChild(btn);
    ul.appendChild(li);
  }

  wrap.appendChild(ul);
  document.body.appendChild(wrap);
  const width = Math.ceil(wrap.getBoundingClientRect().width);
  document.body.removeChild(wrap);
  return width;
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
  menuAlign = 'left',
  fullWidth,
  matchMenuWidth = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuWidthPx, setMenuWidthPx] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const isDisabled = disabled || readOnly;
  const enabledOptions = options.filter((o) => !o.disabled);
  const selectedOption = options.find((o) => o.value === value);
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value && !o.disabled)
  );
  const showPlaceholder = !selectedOption && !!placeholder;
  const widthFull = fullWidth ?? (variant === 'default' || variant === 'compact');

  useLayoutEffect(() => {
    if (!matchMenuWidth) {
      setMenuWidthPx(null);
      return;
    }
    setMenuWidthPx(measureSelectMenuWidth(options));
  }, [matchMenuWidth, options]);

  useLayoutEffect(() => {
    if (!matchMenuWidth || !open) return;
    const menu = document.getElementById(listId);
    if (!menu) return;
    const measured = Math.ceil(menu.getBoundingClientRect().width);
    if (measured > 0) setMenuWidthPx(measured);
  }, [matchMenuWidth, open, listId, options]);

  useEffect(() => {
    if (!open) return;
    const idx = selectedIndex >= 0 ? selectedIndex : 0;
    setActiveIndex(idx);
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (enabledOptions.length === 0) return;
      const navigable = options
        .map((o, i) => ({ o, i }))
        .filter(({ o }) => !o.disabled);
      const navIndex = navigable.findIndex(({ i }) => i === activeIndex);
      const currentNav = navIndex >= 0 ? navIndex : 0;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = navigable[(currentNav + 1) % navigable.length];
        if (next) setActiveIndex(next.i);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = navigable[(currentNav - 1 + navigable.length) % navigable.length];
        if (prev) setActiveIndex(prev.i);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const opt = options[activeIndex];
        if (opt && !opt.disabled) {
          onChange(opt.value);
          setOpen(false);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, options, enabledOptions.length, activeIndex, onChange]);

  const pick = (opt: AppSelectOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
  };

  const toggle = () => {
    if (isDisabled || options.length === 0) return;
    setOpen((v) => !v);
  };

  const triggerLabel = showPlaceholder
    ? placeholder!
    : selectedOption?.label ?? placeholder ?? '—';

  const rootClass = [
    'app-select',
    `app-select--${variant}`,
    open ? 'app-select-open' : '',
    widthFull ? 'app-select--full' : '',
    isDisabled ? 'app-select--disabled' : '',
    showPlaceholder ? 'app-select--placeholder' : '',
    matchMenuWidth ? 'app-select--match-menu' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={rootRef}
      className={rootClass}
      style={matchMenuWidth && menuWidthPx ? { width: menuWidthPx } : undefined}
    >
      {icon && <span className="app-select-icon">{icon}</span>}
      <button
        type="button"
        className="app-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        title={title}
        disabled={isDisabled}
        onClick={toggle}
      >
        <span className="app-select-label">{triggerLabel}</span>
        <ChevronDown size={14} className="app-select-chevron" aria-hidden />
      </button>

      <AnchoredMenu
        anchorRef={rootRef}
        open={open}
        onClose={() => setOpen(false)}
        menuAlign={menuAlign}
        width={matchMenuWidth && menuWidthPx ? menuWidthPx : undefined}
        role="listbox"
        ariaLabel={ariaLabel}
        className={`app-select-menu${
          className.includes('project-status-select') ? ' app-select-menu--status' : ''
        }${
          className.includes('export-project-select') ? ' app-select-menu--export-project' : ''
        }`}
      >
        <ul id={listId} className="app-select-menu-list">
          {options.map((opt, index) => {
            const isSelected = opt.value === value;
            const isActive = index === activeIndex;
            return (
              <li key={opt.value || `opt-${index}`} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={opt.disabled}
                  className={`app-select-option${isSelected ? ' app-select-option-selected' : ''}${
                    isActive && !isSelected ? ' app-select-option-active' : ''
                  }`}
                  onMouseEnter={() => !opt.disabled && setActiveIndex(index)}
                  onClick={() => pick(opt)}
                >
                  <span className="app-select-option-label">{opt.label}</span>
                  {isSelected && (
                    <Check size={14} className="app-select-option-check" aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </AnchoredMenu>
    </div>
  );
}

/** Build options from a string map (e.g. SUBTYPE_LABELS). */
export function selectOptionsFromRecord(record: Record<string, string>): AppSelectOption[] {
  return Object.entries(record).map(([value, label]) => ({ value, label }));
}
