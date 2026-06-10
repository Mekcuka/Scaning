import type { DistanceDefaults } from '../../lib/api';
import type { PoiFormValues, PoiSectionId } from '../../lib/poiParams';

export interface PoiParamsFormProps {
  value: PoiFormValues;
  onChange: (value: PoiFormValues) => void;
  defaults?: DistanceDefaults;
  readOnly?: boolean;
  sections?: PoiSectionId[];
  coordsReadOnly?: boolean;
  /** Без аккордеона — контент секций подряд (для вкладок в панели объекта). */
  flat?: boolean;
}

export interface PoiSectionCommonProps {
  value: PoiFormValues;
  patch: (partial: Partial<PoiFormValues>) => void;
  readOnly?: boolean;
  defaults?: DistanceDefaults;
  coordsReadOnly?: boolean;
}
