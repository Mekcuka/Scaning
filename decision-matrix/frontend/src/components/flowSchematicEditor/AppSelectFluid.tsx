import type { FluidKind } from '../../lib/flowSchematic';
import { FLUID_LABELS } from '../../lib/flowSchematic';
import { AppSelect } from '../AppSelect';

export function AppSelectFluid({
  value,
  onChange,
}: {
  value: FluidKind;
  onChange: (f: FluidKind) => void;
}) {
  return (
    <AppSelect
      variant="sm"
      fullWidth
      value={value}
      onChange={(v) => onChange(v as FluidKind)}
      title="Тип флюида для новой связи"
      options={(['oil', 'water', 'gas'] as const).map((f) => ({
        value: f,
        label: FLUID_LABELS[f],
      }))}
    />
  );
}
