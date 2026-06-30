import { Copy, MapPin } from 'lucide-react';
import { Button, Input } from 'antd';
import type { InfraLayer, InfraObject } from '../../lib/api';
import { capacityUnitLabel, type InfraCapacityUnit } from '../../lib/infraCapacity';
import { AppSelect } from '../AppSelect';
import { DeferredNumberInput } from '../DeferredNumberInput';
import { FieldLabel, PanelSection, ReadOnlyValue, StatChip } from './panelUi';
import { InfraBottomholeGeometrySection } from './InfraBottomholeGeometrySection';
import { InfraBottomholeDetailSection } from './InfraBottomholeDetailSection';
import type { BottomholeFormFields } from './bottomholeFormFields';

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
  showPadWellCountField: boolean;
  padWellCount: string;
  padWellCountDerivedFromBottomholes?: boolean;
  linkedBottomholesCount?: number;
  setPadWellCount: (value: string) => void;
  saving?: boolean;
  isLine: boolean;
  isBottomhole?: boolean;
  linkedBottomholePad?: InfraObject | null;
  endLon?: string;
  setEndLon?: (value: string) => void;
  endLat?: string;
  setEndLat?: (value: string) => void;
  z?: string;
  setZ?: (value: string) => void;
  zHeel?: string;
  setZHeel?: (value: string) => void;
  zToe?: string;
  setZToe?: (value: string) => void;
  onBottomholeFieldsChange?: (patch: Partial<BottomholeFormFields>) => void;
  bottomholeFields?: BottomholeFormFields;
  copyCoordinatesText?: (text: string) => Promise<void>;
  bottomholeCopySources?: import('../../lib/wellBottomholeElevation').BottomholeCopySources;
  bottomholeProjectId?: string | null;
  bottomholeObject?: InfraObject | null;
  bottomholePadOptions?: InfraObject[];
  bottomholeInfraObjects?: InfraObject[];
  lineLengthLabel: string | null;
  lineCoords: [number, number][] | null;
  lon: string;
  setLon: (value: string) => void;
  lat: string;
  setLat: (value: string) => void;
  copyCoordinates: () => Promise<void>;
  description: string;
  setDescription: (value: string) => void;
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
  showPadWellCountField,
  padWellCount,
  padWellCountDerivedFromBottomholes = false,
  linkedBottomholesCount = 0,
  setPadWellCount,
  saving,
  isLine,
  isBottomhole = false,
  linkedBottomholePad = null,
  endLon = '',
  setEndLon = () => {},
  endLat = '',
  setEndLat = () => {},
  z = '',
  setZ = () => {},
  zHeel = '',
  setZHeel = () => {},
  zToe = '',
  setZToe = () => {},
  onBottomholeFieldsChange = () => {},
  bottomholeFields,
  copyCoordinatesText = async () => {},
  bottomholeCopySources,
  bottomholeProjectId = null,
  bottomholeObject = null,
  bottomholePadOptions = [],
  bottomholeInfraObjects = [],
  lineLengthLabel,
  lineCoords,
  lon,
  setLon,
  lat,
  setLat,
  copyCoordinates,
  description,
  setDescription,
}: InfraDetailMainTabProps) {
  const selectedLayerLabel = layers.find((l) => l.id === layerId)?.name;
  const showLayerSourceHint =
    Boolean(layerName) && layerName !== name && layerName !== selectedLayerLabel;
  const showParamsSection =
    showEntryDateField || showThroughputCapacity || showPadWellCountField;

  const classificationTwoColumns = layers.length > 0;
  const operationsFieldCount =
    Number(showEntryDateField) + Number(showThroughputCapacity) + Number(showPadWellCountField);
  const operationsTwoColumns = operationsFieldCount >= 2;

  const capacityHint = [
    capacityUnitLabel(capacityUnit),
    throughputCapacity &&
      !throughputCapacity.isStored &&
      throughputCapacity.value != null &&
      ' · значение по умолчанию для подтипа',
  ]
    .filter(Boolean)
    .join('');

  return (
    <div className="object-detail-panel__tab-sections">
      <PanelSection title="Классификация" card>
        <div
          className={`object-detail-panel__pair-grid${
            classificationTwoColumns ? '' : ' object-detail-panel__pair-grid--single'
          }`}
        >
          <div className="object-detail-panel__pair-grid-row">
            <FieldLabel>Подтип</FieldLabel>
            {classificationTwoColumns && <FieldLabel>Слой</FieldLabel>}
          </div>
          <div className="object-detail-panel__pair-grid-row">
            <div className="object-detail-panel__field-control">
              <AppSelect
                variant="compact"
                value={subtype}
                readOnly={readOnly || subtypeLocked}
                onChange={setSubtype}
                options={infraSubtypeOptions}
              />
            </div>
            {classificationTwoColumns && (
              <div className="object-detail-panel__field-control">
                <AppSelect
                  variant="compact"
                  value={layerId}
                  readOnly={readOnly}
                  onChange={setLayerId}
                  options={layers.map((l) => ({ value: l.id, label: l.name }))}
                />
              </div>
            )}
          </div>
          <div className="object-detail-panel__pair-grid-row object-detail-panel__pair-grid-row--hints">
            <p className="object-detail-panel__hint">
              {subtypeLocked ? 'Подтип фиксирован для этого объекта' : '\u00a0'}
            </p>
            {classificationTwoColumns && (
              <p className="object-detail-panel__hint">
                {showLayerSourceHint ? `Источник: ${layerName}` : '\u00a0'}
              </p>
            )}
          </div>
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
          <div
            className={`object-detail-panel__pair-grid${
              operationsTwoColumns ? '' : ' object-detail-panel__pair-grid--single'
            }`}
          >
            <div className="object-detail-panel__pair-grid-row">
              {showEntryDateField && <FieldLabel>Дата ввода</FieldLabel>}
              {showThroughputCapacity && <FieldLabel>Пропускная способность</FieldLabel>}
              {showPadWellCountField && <FieldLabel>Количество скв., шт</FieldLabel>}
            </div>
            <div className="object-detail-panel__pair-grid-row">
              {showEntryDateField && (
                <div className="object-detail-panel__field-control">
                  {readOnly ? (
                    <ReadOnlyValue placeholder="Не указана">
                      {formatEntryDate(entryDate)}
                    </ReadOnlyValue>
                  ) : (
                    <Input
                      className="object-detail-panel__input"
                      type="date"
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                    />
                  )}
                </div>
              )}
              {showThroughputCapacity && (
                <div className="object-detail-panel__field-control">
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
                      className="object-detail-panel__input"
                      placeholder="Не задана"
                      value={capacityValue}
                      disabled={saving}
                      onCommit={(v) =>
                        setCapacityValue(v === '' ? '' : typeof v === 'number' ? v : Number(v))
                      }
                    />
                  )}
                </div>
              )}
              {showPadWellCountField && (
                <div className="object-detail-panel__field-control">
                  {readOnly ? (
                    <ReadOnlyValue placeholder="Не задано">
                      {padWellCount.trim() !== ''
                        ? Number(padWellCount).toLocaleString('ru-RU')
                        : null}
                    </ReadOnlyValue>
                  ) : (
                    <DeferredNumberInput
                      min={1}
                      max={64}
                      integer
                      className="object-detail-panel__input"
                      placeholder="Не задано"
                      value={padWellCount}
                      disabled={saving || padWellCountDerivedFromBottomholes}
                      onCommit={(v) =>
                        setPadWellCount(v === '' ? '' : String(typeof v === 'number' ? v : Number(v)))
                      }
                    />
                  )}
                </div>
              )}
            </div>
            {(showThroughputCapacity ||
              (showPadWellCountField && padWellCountDerivedFromBottomholes)) && (
              <div className="object-detail-panel__pair-grid-row object-detail-panel__pair-grid-row--hints">
                {showEntryDateField && (
                  <p className="object-detail-panel__hint">{'\u00a0'}</p>
                )}
                {showThroughputCapacity && (
                  <p className="object-detail-panel__hint">{capacityHint || '\u00a0'}</p>
                )}
                {showPadWellCountField && (
                  <p className="object-detail-panel__hint">
                    {padWellCountDerivedFromBottomholes
                      ? `По забоям на карте (${linkedBottomholesCount})`
                      : '\u00a0'}
                  </p>
                )}
              </div>
            )}
          </div>
        </PanelSection>
      )}

      {isBottomhole && bottomholeCopySources ? (
        <InfraBottomholeGeometrySection
          readOnly={readOnly}
          subtype={subtype}
          lon={lon}
          setLon={setLon}
          lat={lat}
          setLat={setLat}
          endLon={endLon}
          setEndLon={setEndLon}
          endLat={endLat}
          setEndLat={setEndLat}
          z={z}
          setZ={setZ}
          zHeel={zHeel}
          setZHeel={setZHeel}
          zToe={zToe}
          setZToe={setZToe}
          linkedPad={linkedBottomholePad}
          copySources={bottomholeCopySources}
          onBottomholeFieldsChange={onBottomholeFieldsChange}
          onCopyCoordinates={copyCoordinatesText}
        />
      ) : isBottomhole ? null : (
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
                <Input
                  className="object-detail-panel__input object-detail-panel__input--mono"
                  value={lon}
                  inputMode="decimal"
                  readOnly={readOnly}
                  disabled={readOnly}
                  onChange={(e) => setLon(e.target.value)}
                />
              </label>
              <label className="object-detail-panel__field">
                <FieldLabel>{isLine ? 'Начало — широта' : 'Широта'}</FieldLabel>
                <Input
                  className="object-detail-panel__input object-detail-panel__input--mono"
                  value={lat}
                  inputMode="decimal"
                  readOnly={readOnly}
                  disabled={readOnly}
                  onChange={(e) => setLat(e.target.value)}
                />
              </label>
            </div>
            <Button
              block
              size="small"
              className="object-detail-panel__copy-btn object-detail-panel__copy-btn--block"
              icon={<Copy size={14} aria-hidden />}
              onClick={() => void copyCoordinates()}
            >
              Копировать координаты
            </Button>
          </div>
          {isLine && (
            <p className="object-detail-panel__hint object-detail-panel__hint--with-icon">
              <MapPin size={12} aria-hidden />
              Конец и форму линии меняйте на карте в режиме редактирования.
            </p>
          )}
        </PanelSection>
      )}

      {isBottomhole && bottomholeProjectId && bottomholeObject && bottomholeFields && (
        <InfraBottomholeDetailSection
          projectId={bottomholeProjectId}
          infraObject={bottomholeObject}
          fields={bottomholeFields}
          onFieldsChange={onBottomholeFieldsChange}
          padOptions={bottomholePadOptions}
          infraObjects={bottomholeInfraObjects}
          readOnly={readOnly}
        />
      )}

      <PanelSection title="Описание" card>
        <label className="object-detail-panel__field">
          <FieldLabel>Комментарий</FieldLabel>
          <Input.TextArea
            className="object-detail-panel__textarea object-detail-panel__textarea--compact"
            value={description}
            rows={4}
            placeholder="Заметки к объекту…"
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
      </PanelSection>
    </div>
  );
}
