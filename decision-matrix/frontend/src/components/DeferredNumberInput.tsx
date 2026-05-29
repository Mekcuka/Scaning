import { useEffect, useState, type KeyboardEvent } from 'react';

export type DeferredNumberInputProps = {
  value: number | string;
  onCommit: (value: number | string) => void;
  readOnly?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  allowEmpty?: boolean;
  integer?: boolean;
  title?: string;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
};

function formatDraft(value: number | string): string {
  if (value === '' || value === null || value === undefined) return '';
  return String(value);
}

function parseDraft(
  raw: string,
  options: { allowEmpty?: boolean; integer?: boolean; min?: number; max?: number }
): number | string | null {
  const trimmed = raw.trim();
  if (trimmed === '') return options.allowEmpty ? '' : null;
  const n = Number(trimmed.replace(',', '.'));
  if (Number.isNaN(n)) return null;
  const val = options.integer ? Math.round(n) : n;
  if (options.min != null && val < options.min) return null;
  if (options.max != null && val > options.max) return null;
  return val;
}

function valuesEqual(a: number | string, b: number | string): boolean {
  if (a === '' && b === '') return true;
  if (a === '' || b === '') return false;
  const na = Number(String(a).replace(',', '.'));
  const nb = Number(String(b).replace(',', '.'));
  if (Number.isFinite(na) && Number.isFinite(nb)) return Math.abs(na - nb) < 1e-9;
  return String(a).trim() === String(b).trim();
}

export function DeferredNumberInput({
  value,
  onCommit,
  readOnly,
  disabled,
  className,
  placeholder,
  min,
  max,
  allowEmpty = false,
  integer = false,
  title,
  onKeyDown,
}: DeferredNumberInputProps) {
  const [draft, setDraft] = useState(() => formatDraft(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(formatDraft(value));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const parsed = parseDraft(draft, { allowEmpty, integer, min, max });
    if (parsed === null) {
      setDraft(formatDraft(value));
      return;
    }
    if (valuesEqual(parsed, value)) return;
    onCommit(parsed);
  };

  const cancel = () => {
    setDraft(formatDraft(value));
    setEditing(false);
  };

  if (readOnly || disabled) {
    return (
      <input
        type="text"
        readOnly
        disabled={disabled}
        className={className}
        title={title}
        value={formatDraft(value)}
      />
    );
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      placeholder={placeholder}
      title={title}
      value={draft}
      onFocus={() => setEditing(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          cancel();
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
