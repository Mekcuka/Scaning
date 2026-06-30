import { Minus, Plus } from 'lucide-react';
import { Input } from 'antd';
import type { ReactNode } from 'react';
import { FieldLabel } from '../objectDetailPanel/panelUi';

function roundToDecimals(n: number, decimals: number): number {
  if (!Number.isFinite(n)) return n;
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

interface DimensionStepperProps {
  label: string;
  value: number;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  decimals?: number;
  readOnly?: boolean;
  onChange: (value: number) => void;
  trailingAction?: ReactNode;
}

export function DimensionStepper({
  label,
  value,
  unit = 'м',
  step = 1,
  min = 1,
  max = 500,
  decimals = 2,
  readOnly = false,
  onChange,
  trailingAction,
}: DimensionStepperProps) {
  const clamp = (n: number) => roundToDecimals(Math.min(max, Math.max(min, n)), decimals);
  const displayValue = roundToDecimals(value, decimals);

  return (
    <div className="pad-earthwork-dim-stepper">
      <FieldLabel>{label}</FieldLabel>
      <div className="pad-earthwork-dim-stepper__row">
        <button
          type="button"
          className="pad-earthwork-dim-stepper__btn"
          disabled={readOnly || displayValue <= min}
          aria-label={`Уменьшить ${label}`}
          onClick={() => onChange(clamp(displayValue - step))}
        >
          <Minus size={14} />
        </button>
        <Input
          className="pad-earthwork-dim-stepper__input"
          type="number"
          min={min}
          max={max}
          step={step}
          value={displayValue}
          readOnly={readOnly}
          disabled={readOnly}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(clamp(n));
          }}
          onBlur={() => onChange(clamp(displayValue))}
        />
        <span className="pad-earthwork-dim-stepper__unit">{unit}</span>
        <button
          type="button"
          className="pad-earthwork-dim-stepper__btn"
          disabled={readOnly || displayValue >= max}
          aria-label={`Увеличить ${label}`}
          onClick={() => onChange(clamp(displayValue + step))}
        >
          <Plus size={14} />
        </button>
        {trailingAction}
      </div>
    </div>
  );
}
