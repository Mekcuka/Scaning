import { AppSelect } from '../AppSelect';
import { DeferredNumberInput } from '../DeferredNumberInput';
import { calcPadsPreview } from '../../lib/poiParams';
import type { PoiSectionCommonProps } from './types';

export function PoiBasicAccordionSection({
  value,
  patch,
  readOnly,
  coordsReadOnly = true,
}: PoiSectionCommonProps) {
  const { wells, pads } = calcPadsPreview(
    value.planned_production_volume,
    value.production_per_well,
    value.wells_per_pad,
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="form-group mb-0">
        <label>Название</label>
        <input
          value={value.name}
          readOnly={readOnly}
          onChange={(e) => patch({ name: e.target.value })}
        />
      </div>
      <div className="form-group mb-0">
        <label>Флюид (FR-4.2.10)</label>
        <AppSelect
          value={value.fluid_type}
          readOnly={readOnly}
          onChange={(v) => patch({ fluid_type: v as 'oil' | 'gas' })}
          options={[
            { value: 'oil', label: 'Нефть' },
            { value: 'gas', label: 'Газ' },
          ]}
        />
      </div>
      <div className="form-group mb-0">
        <label>
          {value.fluid_type === 'gas' ? 'Объём добычи газа (тыс. т/год)' : 'Объём добычи нефти (тыс. т/год)'}
        </label>
        <DeferredNumberInput
          min={0}
          value={value.planned_production_volume}
          readOnly={readOnly}
          onCommit={(v) => patch({ planned_production_volume: v as number })}
        />
      </div>
      <div className="form-group mb-0">
        <label>Объём закачки воды (тыс. т/год)</label>
        <DeferredNumberInput
          min={0}
          value={value.water_injection_volume}
          readOnly={readOnly}
          onCommit={(v) => patch({ water_injection_volume: v as number })}
        />
      </div>
      {value.fluid_type === 'oil' && (
        <div className="form-group mb-0">
          <label>Газовый фактор (м³/т)</label>
          <DeferredNumberInput
            min={0}
            integer
            value={value.gas_factor}
            readOnly={readOnly}
            onCommit={(v) => patch({ gas_factor: v as number })}
          />
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Объём попутного газа на тонну нефти; используется в схеме потоков для ветки «Газ»
          </p>
        </div>
      )}
      <div className="form-group mb-0">
        <label>Добыча на 1 скважину (тыс. т/год)</label>
        <DeferredNumberInput
          min={0.1}
          value={value.production_per_well}
          readOnly={readOnly}
          onCommit={(v) => patch({ production_per_well: v as number })}
        />
      </div>
      <div className="form-group mb-0">
        <label>Скважин на КП</label>
        <DeferredNumberInput
          min={1}
          integer
          value={value.wells_per_pad}
          readOnly={readOnly}
          onCommit={(v) => patch({ wells_per_pad: v as number })}
        />
      </div>
      <div className="form-group mb-0 md:col-span-2">
        <label>Кустовые площадки (авто, FR-5.3.1)</label>
        <div className="text-xs py-2 px-3 rounded-lg" style={{ background: 'var(--bg)' }}>
          Скважин: <strong>{wells.toFixed(1)}</strong> → КП: <strong>{pads} шт.</strong>
        </div>
      </div>
      <div className="form-group mb-0">
        <label>Долгота</label>
        <input
          value={value.lon}
          readOnly={readOnly || coordsReadOnly}
          step="0.001"
          onChange={(e) => patch({ lon: e.target.value })}
        />
      </div>
      <div className="form-group mb-0">
        <label>Широта</label>
        <input
          value={value.lat}
          readOnly={readOnly || coordsReadOnly}
          step="0.001"
          onChange={(e) => patch({ lat: e.target.value })}
        />
      </div>
      {!readOnly && (
        <div className="form-group mb-0 md:col-span-2">
          <label>Описание</label>
          <textarea
            className="min-h-[52px]"
            value={value.description}
            onChange={(e) => patch({ description: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
