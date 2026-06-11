import type { POI } from '../api';
import type { EngineeringParamKey } from '../poiParams';
import type { MatrixCell, MatrixRow } from './types';

export const GAS_FLUID_NOT_REQUIRED_ENGINEERING_KEYS = [
  'eng_injection',
  'eng_oil_preparation',
] as const satisfies readonly EngineeringParamKey[];

const GAS_FLUID_NOT_REQUIRED_SET = new Set<EngineeringParamKey>(
  GAS_FLUID_NOT_REQUIRED_ENGINEERING_KEYS,
);

export function engineeringAppliesToFluid(
  key: EngineeringParamKey,
  fluidType: POI['fluid_type'] | undefined,
): boolean {
  if (fluidType !== 'gas') return true;
  return !GAS_FLUID_NOT_REQUIRED_SET.has(key);
}

/** Row labels in the matrix (may differ from form section titles). */
export const MATRIX_ENGINEERING_ROWS: { key: EngineeringParamKey; label: string }[] = [
  { key: 'eng_power', label: 'Электроснабжение' },
  { key: 'eng_injection', label: 'ППД' },
  { key: 'eng_gas', label: 'Обращение с газом' },
  { key: 'eng_oil_preparation', label: 'Подготовка нефти' },
  { key: 'eng_well_gathering', label: 'Сбор скважин' },
  { key: 'eng_transport', label: 'Транспорт' },
];

const ENGINEERING_LABELS: Record<string, Record<string, string>> = {
  eng_power: { external: 'Внешнее', internal: 'Внутреннее' },
  eng_injection: { centralized: 'Централиз.', local: 'Локальное', none: 'Нет' },
  eng_gas: { well: 'Факел/скважина', power_generation: 'Генерация', flare: 'Факел' },
  eng_oil_preparation: { mkos: 'МКОС', mfns: 'МФНС', ctp: 'ЦПС' },
  eng_well_gathering: { single_tube: 'Однотрубная', dual_tube: 'Двухтрубная' },
  eng_transport: { auto: 'Авто', marine: 'Морской', pipeline: 'Трубопровод' },
};

export function buildEngineeringMatrixRows(pois: POI[]): MatrixRow[] {
  return MATRIX_ENGINEERING_ROWS.map((rowDef) => ({
    label: rowDef.label,
    section: 'Инженерные решения',
    engineering: true,
    engineeringKey: rowDef.key,
    cells: pois.map((poi) => {
      if (!engineeringAppliesToFluid(rowDef.key, poi.fluid_type)) {
        return { text: 'Не требуется' } satisfies MatrixCell;
      }
      const raw = String((poi[rowDef.key] as string | undefined) || '—');
      const mapped = ENGINEERING_LABELS[rowDef.key]?.[raw] || raw;
      return { text: mapped, badge: true } satisfies MatrixCell;
    }),
  }));
}
