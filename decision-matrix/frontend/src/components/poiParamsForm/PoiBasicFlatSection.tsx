import { Input } from 'antd';
import {
  FieldLabel,
  FluidToggle,
  PanelSection,
  PanelSubsection,
  ReadOnlyValue,
} from '../objectDetailPanel/panelUi';
import {
  POI_WATER_VOLUME_UNIT,
  calcPadsPreview,
  poiProductionVolumeUnit,
} from '../../lib/poiParams';
import { formatPoiNum } from './formatNum';
import { PoiNumberField } from './PoiNumberField';
import type { PoiSectionCommonProps } from './types';

export function PoiBasicFlatSection({
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
  const volumeLabel = value.fluid_type === 'gas' ? 'Добыча газа' : 'Добыча нефти';
  const productionUnit = poiProductionVolumeUnit(value.fluid_type);

  return (
    <PanelSection title="Параметры добычи" card>
      <PanelSubsection title="Флюид">
        <FluidToggle
          value={value.fluid_type}
          readOnly={readOnly}
          onChange={(v) => patch({ fluid_type: v })}
        />
      </PanelSubsection>

      <PanelSubsection title="Объёмы">
        <div className="object-detail-panel__fields-grid">
          <PoiNumberField
            label={volumeLabel}
            fieldValue={value.planned_production_volume}
            onCommit={(v) => patch({ planned_production_volume: v })}
            readOnly={readOnly}
            unit={productionUnit}
          />
          {value.fluid_type === 'oil' && (
            <PoiNumberField
              label="Закачка воды"
              fieldValue={value.water_injection_volume}
              onCommit={(v) => patch({ water_injection_volume: v })}
              readOnly={readOnly}
              unit={POI_WATER_VOLUME_UNIT}
            />
          )}
          {value.fluid_type === 'oil' && (
            <PoiNumberField
              label="Газовый фактор"
              fieldValue={value.gas_factor}
              onCommit={(v) => patch({ gas_factor: v })}
              readOnly={readOnly}
              min={0}
              integer
              unit="м³/т"
              span2
              hint="Для ветки «Газ» в схеме потоков"
            />
          )}
        </div>
      </PanelSubsection>

      <div className="object-detail-panel__summary-bar" aria-live="polite">
        <div className="object-detail-panel__summary-item">
          <span className="object-detail-panel__summary-value">{formatPoiNum(wells, 0)}</span>
          <span className="object-detail-panel__summary-label">скважин</span>
        </div>
        <div className="object-detail-panel__summary-divider" aria-hidden />
        <div className="object-detail-panel__summary-item">
          <span className="object-detail-panel__summary-value">{pads}</span>
          <span className="object-detail-panel__summary-label">кустовых площадок</span>
        </div>
      </div>

      <PanelSubsection title="Скважины и КП">
        <div className="object-detail-panel__fields-grid">
          <PoiNumberField
            label="Добыча на скважину"
            fieldValue={value.production_per_well}
            onCommit={(v) => patch({ production_per_well: v })}
            readOnly={readOnly}
            min={0.1}
            unit={productionUnit}
          />
          <PoiNumberField
            label="Скважин на КП"
            fieldValue={value.wells_per_pad}
            onCommit={(v) => patch({ wells_per_pad: v })}
            readOnly={readOnly}
            min={1}
            integer
          />
        </div>
      </PanelSubsection>

      <PanelSubsection title="Положение на карте">
        <div className="object-detail-panel__coord-grid">
          <label className="object-detail-panel__field">
            <FieldLabel>Долгота</FieldLabel>
            <Input
              className="object-detail-panel__input object-detail-panel__input--mono"
              value={value.lon}
              readOnly={readOnly || coordsReadOnly}
              disabled={readOnly || coordsReadOnly}
              step="0.001"
              onChange={(e) => patch({ lon: e.target.value })}
            />
          </label>
          <label className="object-detail-panel__field">
            <FieldLabel>Широта</FieldLabel>
            <Input
              className="object-detail-panel__input object-detail-panel__input--mono"
              value={value.lat}
              readOnly={readOnly || coordsReadOnly}
              disabled={readOnly || coordsReadOnly}
              step="0.001"
              onChange={(e) => patch({ lat: e.target.value })}
            />
          </label>
        </div>
        {!readOnly ? (
          <label className="object-detail-panel__field">
            <FieldLabel>Описание</FieldLabel>
            <Input.TextArea
              className="object-detail-panel__textarea"
              value={value.description}
              placeholder="Необязательно"
              onChange={(e) => patch({ description: e.target.value })}
            />
          </label>
        ) : (
          value.description.trim() && (
            <label className="object-detail-panel__field">
              <FieldLabel>Описание</FieldLabel>
              <ReadOnlyValue>{value.description}</ReadOnlyValue>
            </label>
          )
        )}
      </PanelSubsection>
    </PanelSection>
  );
}
