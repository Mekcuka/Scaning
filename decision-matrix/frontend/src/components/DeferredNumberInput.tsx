import { useEffect, useState, type KeyboardEvent } from 'react';
import { Input } from 'antd';

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
  /** Display spaces as thousands separators (e.g. 500 000). */
  groupDigits?: boolean;
  /** Нативный `<input>` — для компактных встроенных полей (узлы схемы потоков). */
  native?: boolean;
};

function stripNumericInput(raw: string): string {
  return raw.replace(/\s/g, '').replace(',', '.');
}

function formatGroupedNumber(value: number | string): string {
  if (value === '' || value === null || value === undefined) return '';
  const normalized = stripNumericInput(String(value));
  if (normalized === '') return '';
  const [intPart, fracPart] = normalized.split('.');
  const groupedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  if (fracPart == null || fracPart === '') return groupedInt;
  return `${groupedInt}.${fracPart}`;
}

function formatDraft(value: number | string, groupDigits?: boolean): string {
  if (value === '' || value === null || value === undefined) return '';
  return groupDigits ? formatGroupedNumber(value) : String(value);
}

function parseDraft(
  raw: string,
  options: { allowEmpty?: boolean; integer?: boolean; min?: number; max?: number },
): number | string | null {
  const trimmed = raw.trim();
  if (trimmed === '') return options.allowEmpty ? '' : null;
  const n = Number(stripNumericInput(trimmed));
  if (Number.isNaN(n)) return null;
  const val = options.integer ? Math.round(n) : n;
  if (options.min != null && val < options.min) return null;
  if (options.max != null && val > options.max) return null;
  return val;
}

function valuesEqual(a: number | string, b: number | string): boolean {
  if (a === '' && b === '') return true;
  if (a === '' || b === '') return false;
  const na = Number(stripNumericInput(String(a)));
  const nb = Number(stripNumericInput(String(b)));
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
  groupDigits = false,
  native = false,
}: DeferredNumberInputProps) {
  const [draft, setDraft] = useState(() => formatDraft(value, groupDigits));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(formatDraft(value, groupDigits));
  }, [value, editing, groupDigits]);

  const commit = () => {
    setEditing(false);
    const parsed = parseDraft(draft, { allowEmpty, integer, min, max });
    if (parsed === null) {
      setDraft(formatDraft(value, groupDigits));
      return;
    }
    if (valuesEqual(parsed, value)) {
      setDraft(formatDraft(parsed, groupDigits));
      return;
    }
    onCommit(parsed);
    setDraft(formatDraft(parsed, groupDigits));
  };

  const cancel = () => {
    setDraft(formatDraft(value, groupDigits));
    setEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
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
  };

  if (native) {
    if (readOnly || disabled) {
      return (
        <input
          type="text"
          readOnly
          disabled={disabled}
          className={className}
          title={title}
          value={formatDraft(value, groupDigits)}
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
        onKeyDown={handleKeyDown}
      />
    );
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      className={className}
      placeholder={placeholder}
      title={title}
      value={draft}
      readOnly={readOnly}
      disabled={disabled}
      onFocus={() => !readOnly && !disabled && setEditing(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
    />
  );
}
