import { useState } from 'react';
import { ChevronDown, Droplets, Flame } from 'lucide-react';

import {
  POI_WATER_VOLUME_UNIT,
  calcPadsPreview,
  poiProductionVolumeUnit,
  type PoiFormValues,
} from '../../lib/poiParams';
import { PoiEngineeringSection } from './PoiEngineeringSection';
import { formatPoiNum } from './formatNum';
import { PoiCreateNumberField } from './PoiCreateNumberField';

type Props = {
  value: PoiFormValues;
  onChange: (value: PoiFormValues) => void;
  readOnly?: boolean;
};

export function PoiCreateForm({ value, onChange, readOnly }: Props) {
  const [engineeringOpen, setEngineeringOpen] = useState(false);
  const patch = (partial: Partial<PoiFormValues>) => onChange({ ...value, ...partial });
  const { wells, pads } = calcPadsPreview(
    value.planned_production_volume,
    value.production_per_well,
    value.wells_per_pad,
  );
  const productionUnit = poiProductionVolumeUnit(value.fluid_type);
  const volumeLabel = value.fluid_type === 'gas' ? 'Добыча газа' : 'Добыча нефти';
  const isOil = value.fluid_type === 'oil';

  return (
    <div className="poi-create-form">
      <section className="poi-create-form__section" aria-labelledby="poi-create-basic">
        <h3 id="poi-create-basic" className="poi-create-form__section-title">
          Основное
        </h3>
        <div className="poi-create-form__row-top">
          <label className="poi-create-form__field poi-create-form__field--name">
            <span className="poi-create-form__label">Название</span>
            <input
              className="input poi-create-form__name-input"
              value={value.name}
              readOnly={readOnly}
              disabled={readOnly}
              placeholder="Точка_1"
              autoFocus
              onChange={(e) => patch({ name: e.target.value })}
            />
          </label>
          <div className="poi-create-form__fluid-group">
            <span className="poi-create-form__label">Флюид</span>
            <div className="poi-create-form__fluid-toggle" role="group" aria-label="Тип флюида">
              <button
                type="button"
                className={`poi-create-form__fluid-btn${isOil ? ' poi-create-form__fluid-btn--active poi-create-form__fluid-btn--oil' : ''}`}
                aria-pressed={isOil}
                disabled={readOnly}
                onClick={() => patch({ fluid_type: 'oil' })}
              >
                <Droplets size={13} aria-hidden />
                Нефть
              </button>
              <button
                type="button"
                className={`poi-create-form__fluid-btn${!isOil ? ' poi-create-form__fluid-btn--active poi-create-form__fluid-btn--gas' : ''}`}
                aria-pressed={!isOil}
                disabled={readOnly}
                onClick={() => patch({ fluid_type: 'gas' })}
              >
                <Flame size={13} aria-hidden />
                Газ
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="poi-create-form__section" aria-labelledby="poi-create-production">
        <h3 id="poi-create-production" className="poi-create-form__section-title">
          Параметры добычи
        </h3>
        <div className="poi-create-form__grid">
          <PoiCreateNumberField
            label={volumeLabel}
            fieldValue={value.planned_production_volume}
            onCommit={(v) => patch({ planned_production_volume: v })}
            readOnly={readOnly}
            unit={productionUnit}
          />
          {isOil && (
            <PoiCreateNumberField
              label="Закачка воды"
              fieldValue={value.water_injection_volume}
              onCommit={(v) => patch({ water_injection_volume: v })}
              readOnly={readOnly}
              unit={POI_WATER_VOLUME_UNIT}
            />
          )}
          <PoiCreateNumberField
            label="Добыча на скважину"
            fieldValue={value.production_per_well}
            onCommit={(v) => patch({ production_per_well: v })}
            readOnly={readOnly}
            min={0.1}
            unit={productionUnit}
          />
          <PoiCreateNumberField
            label="Скважин на КП"
            fieldValue={value.wells_per_pad}
            onCommit={(v) => patch({ wells_per_pad: v })}
            readOnly={readOnly}
            min={1}
            integer
          />
          {isOil && (
            <PoiCreateNumberField
              label="Газовый фактор"
              fieldValue={value.gas_factor}
              onCommit={(v) => patch({ gas_factor: v })}
              readOnly={readOnly}
              min={0}
              integer
              unit="м³/т"
              span2
              hint="Попутный газ для схемы потоков"
            />
          )}
        </div>

        <div className="poi-create-form__summary" aria-live="polite">
          <div className="poi-create-form__summary-item">
            <span className="poi-create-form__summary-value">{formatPoiNum(wells, 0)}</span>
            <span className="poi-create-form__summary-label">скважин</span>
          </div>
          <div className="poi-create-form__summary-divider" aria-hidden />
          <div className="poi-create-form__summary-item">
            <span className="poi-create-form__summary-value">{pads}</span>
            <span className="poi-create-form__summary-label">кустовых площадок</span>
          </div>
        </div>
      </section>

      {!readOnly && (
        <label className="poi-create-form__field">
          <span className="poi-create-form__label">Описание</span>
          <textarea
            className="input poi-create-form__textarea"
            value={value.description}
            rows={2}
            placeholder="Необязательно"
            onChange={(e) => patch({ description: e.target.value })}
          />
        </label>
      )}

      <div className="poi-create-form__advanced">
        <button
          type="button"
          className="poi-create-form__advanced-toggle"
          onClick={() => setEngineeringOpen((v) => !v)}
          aria-expanded={engineeringOpen}
        >
          <span>Инженерные параметры</span>
          <span className="poi-create-form__advanced-meta">по умолчанию</span>
          <ChevronDown
            size={15}
            className={engineeringOpen ? 'poi-create-form__chev--open' : undefined}
            aria-hidden
          />
        </button>
        {engineeringOpen && (
          <div className="poi-create-form__advanced-body">
            <PoiEngineeringSection value={value} patch={patch} readOnly={readOnly} flat />
          </div>
        )}
      </div>

      <p className="poi-create-form__footnote">
        Пороги и нормы км/КП наследуются из проекта. Изменить можно в карточке POI после сохранения.
      </p>
    </div>
  );
}
