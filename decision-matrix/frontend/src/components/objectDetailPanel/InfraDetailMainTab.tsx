import { Copy } from 'lucide-react';
import type { InfraLayer } from '../../lib/api';
import { capacityUnitLabel, type InfraCapacityUnit } from '../../lib/infraCapacity';
import { AppSelect } from '../AppSelect';
import { DeferredNumberInput } from '../DeferredNumberInput';
import { FieldLabel, PanelSection } from './panelUi';

interface InfraDetailMainTabProps {
  readOnly: boolean;
  subtype: string;
  setSubtype: (value: string) => void;
  subtypeLocked: boolean;
  infraSubtypeOptions: { value: string; label: string }[];
  layers: InfraLayer[];
  layerId: string;
  setLayerId: (value: string) => void;
  layerName?: string;
  name: string;
  sparkType: string | null;
  showEntryDateField: boolean;
  entryDate: string;
  setEntryDate: (value: string) => void;
  showThroughputCapacity: boolean;
  capacityUnit: string;
  capacityValue: number | '';
  setCapacityValue: (value: number | '') => void;
  throughputCapacity: { value: number | null; unit: InfraCapacityUnit; isStored: boolean } | null;
  saving?: boolean;
  isLine: boolean;
  lineLengthLabel: string | null;
  lineCoords: [number, number][] | null;
  lon: string;
  setLon: (value: string) => void;
  lat: string;
  setLat: (value: string) => void;
  copyCoordinates: () => Promise<void>;
}

export function InfraDetailMainTab({
  readOnly,
  subtype,
  setSubtype,
  subtypeLocked,
  infraSubtypeOptions,
  layers,
  layerId,
  setLayerId,
  layerName,
  name,
  sparkType,
  showEntryDateField,
  entryDate,
  setEntryDate,
  showThroughputCapacity,
  capacityUnit,
  capacityValue,
  setCapacityValue,
  throughputCapacity,
  saving,
  isLine,
  lineLengthLabel,
  lineCoords,
  lon,
  setLon,
  lat,
  setLat,
  copyCoordinates,
}: InfraDetailMainTabProps) {
  return (
    <>
      <label className="object-detail-panel__field">
        <FieldLabel>Подтип</FieldLabel>
        <AppSelect
          variant="compact"
          value={subtype}
          readOnly={readOnly || subtypeLocked}
          onChange={setSubtype}
          options={infraSubtypeOptions}
        />
        {subtypeLocked && (
          <p className="object-detail-panel__hint">Подтип фиксирован для этого объекта</p>
        )}
      </label>
      {layers.length > 0 && (
        <label className="object-detail-panel__field">
          <FieldLabel>Слой</FieldLabel>
          <AppSelect
            variant="compact"
            value={layerId}
            readOnly={readOnly}
            onChange={setLayerId}
            options={layers.map((l) => ({ value: l.id, label: l.name }))}
          />
          {layerName && layerName !== name && (
            <p className="object-detail-panel__hint">{layerName}</p>
          )}
        </label>
      )}
      {sparkType && (
        <p className="object-detail-panel__meta">
          Искра: <span className="font-mono">{sparkType}</span>
        </p>
      )}
      {showEntryDateField && (
        <label className="object-detail-panel__field">
          <FieldLabel>Дата ввода</FieldLabel>
          <input
            className="input object-detail-panel__input"
            type="date"
            value={entryDate}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(e) => setEntryDate(e.target.value)}
          />
        </label>
      )}
      {showThroughputCapacity && (
        <label className="object-detail-panel__field">
          <FieldLabel>Пропускная способность ({capacityUnitLabel(capacityUnit)})</FieldLabel>
          {readOnly ? (
            <span className="text-sm tabular-nums">
              {capacityValue !== ''
                ? `${Number(capacityValue).toLocaleString('ru-RU')} ${capacityUnitLabel(capacityUnit)}`
                : 'Не задана'}
            </span>
          ) : (
            <DeferredNumberInput
              allowEmpty
              min={0}
              className="input object-detail-panel__input"
              placeholder="Не задана"
              value={capacityValue}
              disabled={saving}
              onCommit={(v) =>
                setCapacityValue(v === '' ? '' : typeof v === 'number' ? v : Number(v))
              }
            />
          )}
          {throughputCapacity && !throughputCapacity.isStored && throughputCapacity.value != null && (
            <p className="object-detail-panel__hint">Значение по умолчанию для подтипа</p>
          )}
        </label>
      )}

      <PanelSection title={isLine ? 'Геометрия линии' : 'Координаты'}>
        {isLine && lineLengthLabel && (
          <div className="object-detail-panel__stats">
            <span>Длина: {lineLengthLabel}</span>
            {lineCoords && lineCoords.length > 2 && (
              <span>Вершин: {lineCoords.length}</span>
            )}
          </div>
        )}
        <div className="object-detail-panel__coord-grid">
          <label className="object-detail-panel__field">
            <FieldLabel>{isLine ? 'Начало — долгота' : 'Долгота'}</FieldLabel>
            <input
              className="input object-detail-panel__input"
              value={lon}
              inputMode="decimal"
              readOnly={readOnly}
              disabled={readOnly}
              onChange={(e) => setLon(e.target.value)}
            />
          </label>
          <label className="object-detail-panel__field">
            <FieldLabel>{isLine ? 'Начало — широта' : 'Широта'}</FieldLabel>
            <input
              className="input object-detail-panel__input"
              value={lat}
              inputMode="decimal"
              readOnly={readOnly}
              disabled={readOnly}
              onChange={(e) => setLat(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm object-detail-panel__copy-btn"
          onClick={() => void copyCoordinates()}
        >
          <Copy size={14} />
          Копировать координаты
        </button>
        {isLine && (
          <p className="object-detail-panel__hint">
            Конец и форму линии меняйте перетаскиванием на карте в режиме редактирования.
          </p>
        )}
      </PanelSection>
    </>
  );
}
