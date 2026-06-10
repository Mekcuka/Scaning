import { Copy, MapPin } from 'lucide-react';
import type { InfraLayer } from '../../lib/api';
import { capacityUnitLabel, type InfraCapacityUnit } from '../../lib/infraCapacity';
import { AppSelect } from '../AppSelect';
import { DeferredNumberInput } from '../DeferredNumberInput';
import { FieldLabel, PanelSection, ReadOnlyValue, StatChip } from './panelUi';

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

function formatEntryDate(value: string): string {
  if (!value) return '';
  const [y, m, d] = value.split('-');
  if (!y || !m || !d) return value;
  return `${d}.${m}.${y}`;
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
  const selectedLayerLabel = layers.find((l) => l.id === layerId)?.name;
  const showLayerSourceHint =
    Boolean(layerName) && layerName !== name && layerName !== selectedLayerLabel;
  const showParamsSection = showEntryDateField || showThroughputCapacity;

  return (
    <>
      <PanelSection title="Классификация" card>
        <div className="object-detail-panel__fields-grid">
          <label
            className={`object-detail-panel__field${
              layers.length === 0 ? ' object-detail-panel__field--span-2' : ''
            }`}
          >
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
              {showLayerSourceHint && (
                <p className="object-detail-panel__hint">Источник: {layerName}</p>
              )}
            </label>
          )}
        </div>
        {sparkType && (
          <p className="object-detail-panel__meta object-detail-panel__meta--badge">
            <span className="object-detail-panel__spark-badge">Искра</span>
            <span className="font-mono">{sparkType}</span>
          </p>
        )}
      </PanelSection>

      {showParamsSection && (
        <PanelSection title="Эксплуатация" card>
          <div className="object-detail-panel__fields-grid">
            {showEntryDateField && (
              <label className="object-detail-panel__field">
                <FieldLabel>Дата ввода</FieldLabel>
                {readOnly ? (
                  <ReadOnlyValue placeholder="Не указана">
                    {formatEntryDate(entryDate)}
                  </ReadOnlyValue>
                ) : (
                  <input
                    className="input object-detail-panel__input"
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                  />
                )}
              </label>
            )}
            {showThroughputCapacity && (
              <label
                className={`object-detail-panel__field${
                  showEntryDateField ? '' : ' object-detail-panel__field--span-2'
                }`}
              >
                <FieldLabel>Пропускная способность</FieldLabel>
                {readOnly ? (
                  <ReadOnlyValue placeholder="Не задана">
                    {capacityValue !== ''
                      ? `${Number(capacityValue).toLocaleString('ru-RU')} ${capacityUnitLabel(capacityUnit)}`
                      : null}
                  </ReadOnlyValue>
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
                <p className="object-detail-panel__hint">
                  {capacityUnitLabel(capacityUnit)}
                  {throughputCapacity &&
                    !throughputCapacity.isStored &&
                    throughputCapacity.value != null &&
                    ' · значение по умолчанию для подтипа'}
                </p>
              </label>
            )}
          </div>
        </PanelSection>
      )}

      <PanelSection title={isLine ? 'Геометрия линии' : 'Координаты'} card>
        {isLine && (lineLengthLabel || (lineCoords && lineCoords.length > 2)) && (
          <div className="object-detail-panel__stats">
            {lineLengthLabel && <StatChip>Длина: {lineLengthLabel}</StatChip>}
            {lineCoords && lineCoords.length > 2 && (
              <StatChip>Вершин: {lineCoords.length}</StatChip>
            )}
          </div>
        )}
        <div className="object-detail-panel__coord-card">
          <div className="object-detail-panel__coord-grid">
            <label className="object-detail-panel__field">
              <FieldLabel>{isLine ? 'Начало — долгота' : 'Долгота'}</FieldLabel>
              <input
                className="input object-detail-panel__input object-detail-panel__input--mono"
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
                className="input object-detail-panel__input object-detail-panel__input--mono"
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
            className="btn btn-secondary btn-sm object-detail-panel__copy-btn object-detail-panel__copy-btn--block"
            onClick={() => void copyCoordinates()}
          >
            <Copy size={14} aria-hidden />
            Копировать координаты
          </button>
        </div>
        {isLine && (
          <p className="object-detail-panel__hint object-detail-panel__hint--with-icon">
            <MapPin size={12} aria-hidden />
            Конец и форму линии меняйте на карте в режиме редактирования.
          </p>
        )}
      </PanelSection>
    </>
  );
}
