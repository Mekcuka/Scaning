import { DeferredNumberInput } from '../DeferredNumberInput';
import { ReadOnlyValue } from '../objectDetailPanel/panelUi';
import { formatPoiNum } from './formatNum';

export function PoiCreateNumberField({
  label,
  fieldValue,
  onCommit,
  readOnly,
  min,
  integer,
  hint,
  unit,
  span2,
}: {
  label: string;
  fieldValue: number;
  onCommit: (v: number) => void;
  readOnly?: boolean;
  min?: number;
  integer?: boolean;
  hint?: string;
  unit?: string;
  span2?: boolean;
}) {
  return (
    <label
      className={`poi-create-form__num${span2 ? ' poi-create-form__num--span2' : ''}`}
    >
      <span className="poi-create-form__num-head">
        <span className="poi-create-form__num-label">{label}</span>
        {unit && <span className="poi-create-form__num-unit">{unit}</span>}
      </span>
      {readOnly ? (
        <ReadOnlyValue>{formatPoiNum(fieldValue, integer ? 0 : 1)}</ReadOnlyValue>
      ) : (
        <DeferredNumberInput
          min={min}
          integer={integer}
          className="input poi-create-form__num-input"
          value={fieldValue}
          onCommit={(v) => onCommit(v as number)}
        />
      )}
      {hint && <p className="poi-create-form__num-hint">{hint}</p>}
    </label>
  );
}
