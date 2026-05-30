import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, Trash2, X } from 'lucide-react';
import { formatCoord, parseCoord } from '../lib/coords';
import {
  api,
  infraSubtypeSelectOptions,
  isImmutablePointSubtype,
  SUBTYPE_LABELS,
  type InfraLayer,
  type InfraObject,
  type POI,
} from '../lib/api';
import { getLineCoordinates, isLineSubtype } from '../lib/infraGeometry';
import { iconDataUrl } from '../lib/mapIcons';
import { formatLengthMeters, lineLengthMeters } from '../lib/mapMeasure';
import { formValuesToPoiPayload, poiToFormValues, type PoiFormValues } from '../lib/poiParams';
import { useAppStore } from '../store';
import {
  capacityUnitLabel,
  defaultCapacityUnitForSubtype,
  effectiveThroughputCapacity,
  pointShowsThroughputCapacity,
} from '../lib/infraCapacity';
import {
  isSandConsumerSubtype,
  isSandQuarrySubtype,
  mergeQuarryVolumes,
  mergeSandDemandM3,
  readQuarryVolumes,
  readSandDemandM3,
} from '../lib/infraSandVolumes';
import {
  mergeEntryDate,
  objectShowsEntryDate,
  readEntryDateIso,
} from '../lib/infraEntryDate';
import { AppSelect } from './AppSelect';
import { InfraCapacityModal } from './InfraCapacityModal';
import { PoiParamsForm } from './PoiParamsForm';

export type SelectedFeature =
  | { kind: 'poi'; poi: POI }
  | { kind: 'infra'; object: InfraObject };

interface ObjectDetailPanelProps {
  selection: SelectedFeature;
  layers: InfraLayer[];
  onSave: (data: Record<string, unknown>) => void;
  onSaveCapacity?: (value: number | null) => void;
  onDelete: () => void;
  onClose: () => void;
  saving?: boolean;
  capacitySaving?: boolean;
  readOnly?: boolean;
}

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="object-detail-panel__section">
      <h3 className="object-detail-panel__section-title">{title}</h3>
      {children}
    </section>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="object-detail-panel__label">{children}</span>;
}

export function ObjectDetailPanel({
  selection,
  layers,
  onSave,
  onSaveCapacity,
  onDelete,
  onClose,
  saving,
  capacitySaving,
  readOnly = false,
}: ObjectDetailPanelProps) {
  const pushToast = useAppStore((s) => s.pushToast);
  const [capacityModalOpen, setCapacityModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subtype, setSubtype] = useState('');
  const [layerId, setLayerId] = useState('');
  const [lon, setLon] = useState('');
  const [lat, setLat] = useState('');
  const [poiForm, setPoiForm] = useState<PoiFormValues | null>(null);
  const [sandInitialM3, setSandInitialM3] = useState('');
  const [sandCurrentM3, setSandCurrentM3] = useState('');
  const [sandDemandM3, setSandDemandM3] = useState('');
  const [entryDate, setEntryDate] = useState('');

  const projectId = selection.kind === 'poi' ? selection.poi.project_id : null;
  const { data: defaults } = useQuery({
    queryKey: ['distanceDefaults', projectId],
    queryFn: () => api.getDistanceDefaults(projectId!),
    enabled: !!projectId,
    retry: false,
  });

  useEffect(() => {
    if (selection.kind === 'poi') {
      setPoiForm(poiToFormValues(selection.poi));
      return;
    }
    const o = selection.object;
    setName(o.name);
    setDescription((o.properties?.description as string) || '');
    setSubtype(o.subtype);
    setLayerId(o.layer_id);
    setLon(formatCoord(o.lon));
    setLat(formatCoord(o.lat));
    setPoiForm(null);
    const { initial, current } = readQuarryVolumes(o.properties);
    if (isSandQuarrySubtype(o.subtype)) {
      setSandInitialM3(initial > 0 ? String(initial) : '');
      setSandCurrentM3(current > 0 ? String(current) : '');
      setSandDemandM3('');
    } else if (isSandConsumerSubtype(o.subtype) && !isLineSubtype(o.subtype)) {
      const d = readSandDemandM3(o.properties);
      setSandDemandM3(d > 0 ? String(d) : '');
      setSandInitialM3('');
      setSandCurrentM3('');
    } else {
      setSandInitialM3('');
      setSandCurrentM3('');
      setSandDemandM3('');
    }
    setEntryDate(objectShowsEntryDate(o.subtype) ? readEntryDateIso(o.properties) : '');
  }, [selection]);

  const isPoi = selection.kind === 'poi';
  const infraObject = selection.kind === 'infra' ? selection.object : null;

  const handleSave = useCallback(() => {
    if (readOnly) return;
    if (isPoi && poiForm) {
      onSave(formValuesToPoiPayload(poiForm));
      return;
    }
    const payload: Record<string, unknown> = {
      name,
      description,
      subtype,
      layer_id: layerId,
    };

    if (selection.kind === 'infra') {
      let props: Record<string, unknown> = { ...(selection.object.properties ?? {}), description };
      if (isSandQuarrySubtype(subtype) && !isLineSubtype(subtype)) {
        const initial = sandInitialM3.trim() ? parseFloat(sandInitialM3) : null;
        const current = sandCurrentM3.trim() ? parseFloat(sandCurrentM3) : null;
        props = mergeQuarryVolumes(props, initial, current);
      } else if (isSandConsumerSubtype(subtype) && !isLineSubtype(subtype)) {
        const demand = sandDemandM3.trim() ? parseFloat(sandDemandM3) : null;
        props = mergeSandDemandM3(props, demand);
      }
      if (objectShowsEntryDate(subtype)) {
        props = mergeEntryDate(props, entryDate.trim() || null);
      }
      payload.properties = props;

      if (isLineSubtype(subtype)) {
        const coords = getLineCoordinates(selection.object);
        if (coords) {
          const next = coords.map((c) => [...c] as [number, number]);
          next[0] = [parseCoord(lon), parseCoord(lat)];
          payload.coordinates = next;
          payload.lon = next[0][0];
          payload.lat = next[0][1];
          payload.end_lon = next[next.length - 1][0];
          payload.end_lat = next[next.length - 1][1];
        } else {
          payload.lon = parseCoord(lon);
          payload.lat = parseCoord(lat);
        }
      } else {
        payload.lon = parseCoord(lon);
        payload.lat = parseCoord(lat);
      }
    } else {
      payload.lon = parseCoord(lon);
      payload.lat = parseCoord(lat);
    }

    onSave(payload);
  }, [
    readOnly,
    isPoi,
    poiForm,
    onSave,
    name,
    description,
    subtype,
    layerId,
    lon,
    lat,
    selection,
    sandInitialM3,
    sandCurrentM3,
    sandDemandM3,
    entryDate,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [readOnly, handleSave]);

  const isLine = infraObject != null && isLineSubtype(infraObject.subtype);
  const lineCoords = infraObject ? getLineCoordinates(infraObject) : null;
  const lineLengthLabel =
    lineCoords && lineCoords.length >= 2
      ? formatLengthMeters(lineLengthMeters(lineCoords))
      : null;

  const subtypeLabel = SUBTYPE_LABELS[subtype] || subtype;
  const layerName = layers.find((l) => l.id === layerId)?.name;
  const sparkType =
    infraObject?.properties?.spark_type != null
      ? String(infraObject.properties.spark_type)
      : null;

  const infraSubtypeOptions =
    selection.kind === 'infra' ? infraSubtypeSelectOptions(selection.object) : [];
  const subtypeLocked =
    selection.kind === 'infra' && isImmutablePointSubtype(selection.object.subtype);

  const showThroughputCapacity =
    selection.kind === 'infra' && pointShowsThroughputCapacity(selection.object.subtype);
  const showSandQuarryFields =
    selection.kind === 'infra' && isSandQuarrySubtype(subtype) && !isLine;
  const showSandDemandField =
    selection.kind === 'infra' && isSandConsumerSubtype(subtype) && !isLine;
  const showEntryDateField = selection.kind === 'infra' && objectShowsEntryDate(subtype);
  const quarryVolumeWarning =
    showSandQuarryFields &&
    sandInitialM3.trim() &&
    sandCurrentM3.trim() &&
    parseFloat(sandCurrentM3) > parseFloat(sandInitialM3);
  const throughputCapacity = useMemo(() => {
    if (!infraObject) return null;
    return effectiveThroughputCapacity(infraObject.subtype, infraObject.properties);
  }, [infraObject]);

  const isDirty = useMemo(() => {
    if (isPoi && poiForm) {
      const orig = poiToFormValues(selection.poi);
      return JSON.stringify(poiForm) !== JSON.stringify(orig);
    }
    if (!infraObject) return false;
    const origDesc = (infraObject.properties?.description as string) || '';
    const origQ = readQuarryVolumes(infraObject.properties);
    const sandDirty =
      (isSandQuarrySubtype(infraObject.subtype) &&
        !isLine &&
        (sandInitialM3 !== (origQ.initial > 0 ? String(origQ.initial) : '') ||
          sandCurrentM3 !== (origQ.current > 0 ? String(origQ.current) : ''))) ||
      (isSandConsumerSubtype(infraObject.subtype) &&
        !isLine &&
        sandDemandM3 !==
          (readSandDemandM3(infraObject.properties) > 0
            ? String(readSandDemandM3(infraObject.properties))
            : ''));
    const entryDirty =
      objectShowsEntryDate(infraObject.subtype) &&
      entryDate !== readEntryDateIso(infraObject.properties);
    return (
      name !== infraObject.name ||
      description !== origDesc ||
      subtype !== infraObject.subtype ||
      layerId !== infraObject.layer_id ||
      lon !== formatCoord(infraObject.lon) ||
      lat !== formatCoord(infraObject.lat) ||
      sandDirty ||
      entryDirty
    );
  }, [
    isPoi,
    poiForm,
    selection,
    infraObject,
    name,
    description,
    subtype,
    layerId,
    lon,
    lat,
    isLine,
    sandInitialM3,
    sandCurrentM3,
    sandDemandM3,
    entryDate,
  ]);

  const copyCoordinates = async () => {
    const text = `${lon}, ${lat}`;
    try {
      await navigator.clipboard.writeText(text);
      pushToast('success', 'Координаты скопированы');
    } catch {
      pushToast('error', 'Не удалось скопировать');
    }
  };

  const displayName = isPoi ? (poiForm?.name ?? selection.poi.name) : name || 'Объект';
  const headerIcon = isPoi ? iconDataUrl('poi') : iconDataUrl(subtype);

  const setDisplayName = (value: string) => {
    if (isPoi && poiForm) {
      setPoiForm({ ...poiForm, name: value });
      return;
    }
    setName(value);
  };

  return (
    <div
      className="object-detail-panel"
      role="dialog"
      aria-label={isPoi ? 'Точка интереса' : 'Объект'}
    >
      <header className="object-detail-panel__header">
        <div className="object-detail-panel__header-main">
          <img src={headerIcon} alt="" className="object-detail-panel__icon" draggable={false} />
          <div className="object-detail-panel__header-text min-w-0">
            <div className="object-detail-panel__title-row">
              {readOnly ? (
                <span className="object-detail-panel__title truncate" title={displayName}>
                  {displayName}
                </span>
              ) : (
                <input
                  type="text"
                  className="object-detail-panel__title-input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  aria-label="Название объекта"
                  title="Название объекта"
                />
              )}
              {isDirty && !readOnly && (
                <span className="object-detail-panel__dirty" title="Есть несохранённые изменения">
                  ●
                </span>
              )}
            </div>
            <span className="object-detail-panel__badge">{isPoi ? 'Точка интереса' : subtypeLabel}</span>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon-touch object-detail-panel__close"
          onClick={onClose}
          title="Закрыть (Esc)"
          aria-label="Закрыть"
        >
          <X size={16} />
        </button>
      </header>

      <div className="object-detail-panel__body">
        {isPoi && poiForm ? (
          <PoiParamsForm
            value={poiForm}
            onChange={setPoiForm}
            defaults={defaults}
            readOnly={readOnly}
            coordsReadOnly={readOnly}
          />
        ) : (
          <>
            <PanelSection title="Основное">
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
            </PanelSection>

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

            {(showSandQuarryFields || showSandDemandField) && (
              <PanelSection title="Песок">
                {showSandQuarryFields && (
                  <div className="object-detail-panel__coord-grid">
                    <label className="object-detail-panel__field">
                      <FieldLabel>Изначальный объём, м³</FieldLabel>
                      <input
                        className="input object-detail-panel__input"
                        type="number"
                        min={0}
                        step="any"
                        value={sandInitialM3}
                        readOnly={readOnly}
                        disabled={readOnly}
                        onChange={(e) => setSandInitialM3(e.target.value)}
                      />
                    </label>
                    <label className="object-detail-panel__field">
                      <FieldLabel>Текущий объём, м³</FieldLabel>
                      <input
                        className="input object-detail-panel__input"
                        type="number"
                        min={0}
                        step="any"
                        value={sandCurrentM3}
                        readOnly={readOnly}
                        disabled={readOnly}
                        onChange={(e) => setSandCurrentM3(e.target.value)}
                      />
                    </label>
                  </div>
                )}
                {showSandDemandField && (
                  <label className="object-detail-panel__field">
                    <FieldLabel>Объём песка (спрос), м³</FieldLabel>
                    <input
                      className="input object-detail-panel__input"
                      type="number"
                      min={0}
                      step="any"
                      value={sandDemandM3}
                      readOnly={readOnly}
                      disabled={readOnly}
                      onChange={(e) => setSandDemandM3(e.target.value)}
                    />
                  </label>
                )}
                {quarryVolumeWarning && (
                  <p className="object-detail-panel__hint text-amber-600">
                    Текущий объём больше изначального.
                  </p>
                )}
              </PanelSection>
            )}

            <PanelSection title="Дополнительно">
              {showThroughputCapacity && throughputCapacity && (
                <div className="object-detail-panel__field mb-3">
                  <FieldLabel>Пропускная способность</FieldLabel>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm tabular-nums">
                      {throughputCapacity.value != null
                        ? `${throughputCapacity.value.toLocaleString('ru-RU')} ${capacityUnitLabel(
                            throughputCapacity.unit || defaultCapacityUnitForSubtype(subtype)
                          )}`
                        : 'Не задана'}
                    </span>
                    {!readOnly && onSaveCapacity && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={capacitySaving}
                        onClick={() => setCapacityModalOpen(true)}
                      >
                        Изменить…
                      </button>
                    )}
                  </div>
                </div>
              )}
              <label className="object-detail-panel__field">
                <FieldLabel>Описание</FieldLabel>
                <textarea
                  className="input object-detail-panel__textarea"
                  value={description}
                  rows={3}
                  placeholder="Комментарий к объекту…"
                  readOnly={readOnly}
                  disabled={readOnly}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
            </PanelSection>
          </>
        )}
      </div>

      <footer className="object-detail-panel__footer">
        {!readOnly && (
          <>
            <button
              type="button"
              className="btn btn-primary object-detail-panel__save"
              disabled={saving || !isDirty}
              onClick={handleSave}
              title="Сохранить (Ctrl+S)"
            >
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
            <button
              type="button"
              className="btn btn-secondary object-detail-panel__delete"
              disabled={saving}
              onClick={onDelete}
              title="Удалить объект"
            >
              <Trash2 size={15} />
              Удалить
            </button>
          </>
        )}
      </footer>

      {showThroughputCapacity && infraObject && onSaveCapacity && (
        <InfraCapacityModal
          open={capacityModalOpen}
          objectName={infraObject.name}
          subtype={infraObject.subtype}
          properties={infraObject.properties}
          saving={capacitySaving}
          onClose={() => setCapacityModalOpen(false)}
          onApply={(value) => {
            onSaveCapacity(value);
            setCapacityModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
