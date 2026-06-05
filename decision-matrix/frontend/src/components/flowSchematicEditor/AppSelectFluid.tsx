import type { FluidKind } from '../../lib/flowSchematic';
import { FLUID_LABELS } from '../../lib/flowSchematic';

export function AppSelectFluid({
  value,
  onChange,
}: {
  value: FluidKind;
  onChange: (f: FluidKind) => void;
}) {
  return (
    <select
      className="input text-sm py-1.5 px-2 w-full"
      value={value}
      onChange={(e) => onChange(e.target.value as FluidKind)}
      title="Тип флюида для новой связи"
    >
      {(['oil', 'water', 'gas'] as const).map((f) => (
        <option key={f} value={f}>
          {FLUID_LABELS[f]}
        </option>
      ))}
    </select>
  );
}
