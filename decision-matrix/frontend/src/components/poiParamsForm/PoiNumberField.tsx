import { DeferredNumberInput } from '../DeferredNumberInput';
import { FieldLabel, ReadOnlyValue } from '../objectDetailPanel/panelUi';
import { formatPoiNum } from './formatNum';

export function PoiNumberField({
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
      className={`object-detail-panel__field${span2 ? ' object-detail-panel__field--span-2' : ''}`}
    >
      <FieldLabel unit={unit}>{label}</FieldLabel>
      {readOnly ? (
        <ReadOnlyValue>{formatPoiNum(fieldValue, integer ? 0 : 1)}</ReadOnlyValue>
      ) : (
        <DeferredNumberInput
          min={min}
          integer={integer}
          className="object-detail-panel__input"
          value={fieldValue}
          onCommit={(v) => onCommit(v as number)}
        />
      )}
      {hint && <p className="object-detail-panel__hint">{hint}</p>}
    </label>
  );
}
