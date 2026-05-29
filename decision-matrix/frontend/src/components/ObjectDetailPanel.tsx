import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { formatCoord, parseCoord } from '../lib/coords';
import {
  api,
  infraSubtypeSelectOptions,
  isImmutablePointSubtype,
  type InfraLayer,
  type InfraObject,
  type POI,
} from '../lib/api';
import { getLineCoordinates, isLineSubtype } from '../lib/infraGeometry';
import {
  capacityUnitLabel,
  defaultCapacityUnitForSubtype,
  mergeThroughputCapacity,
  pointShowsThroughputCapacity,
  readThroughputCapacity,
} from '../lib/infraCapacity';
import { AppSelect } from './AppSelect';
import { DeferredNumberInput } from './DeferredNumberInput';
import { PoiParamsForm } from './PoiParamsForm';
import { formValuesToPoiPayload, poiToFormValues, type PoiFormValues } from '../lib/poiParams';

export type SelectedFeature =
  | { kind: 'poi'; poi: POI }
  | { kind: 'infra'; object: InfraObject };

interface ObjectDetailPanelProps {
  selection: SelectedFeature;
  layers: InfraLayer[];
  onSave: (data: Record<string, unknown>) => void;
  onDelete: () => void;
  onClose: () => void;
  saving?: boolean;
  readOnly?: boolean;
}

export function ObjectDetailPanel({
  selection,
  layers,
  onSave,
  onDelete,
  onClose,
  saving,
  readOnly = false,
}: ObjectDetailPanelProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subtype, setSubtype] = useState('');
  const [layerId, setLayerId] = useState('');
  const [lon, setLon] = useState('');
  const [lat, setLat] = useState('');
  const [throughputCapacity, setThroughputCapacity] = useState('');
  const [poiForm, setPoiForm] = useState<PoiFormValues | null>(null);

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
    const cap = readThroughputCapacity(o.properties);
    setThroughputCapacity(cap.value != null ? String(cap.value) : '');
    setPoiForm(null);
  }, [selection]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isPoi = selection.kind === 'poi';
  const title = isPoi ? 'Точка интереса' : 'Объект';

  const infraSubtypeOptions =
    selection.kind === 'infra' ? infraSubtypeSelectOptions(selection.object) : [];
  const subtypeLocked =
    selection.kind === 'infra' && isImmutablePointSubtype(selection.object.subtype);

  const showThroughputCapacity =
    selection.kind === 'infra' && pointShowsThroughputCapacity(selection.object.subtype);
  const capacityUnit =
    selection.kind === 'infra'
      ? capacityUnitLabel(
          readThroughputCapacity(selection.object.properties).unit ||
            defaultCapacityUnitForSubtype(selection.object.subtype)
        )
      : '';

  const handleSave = () => {
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
      if (pointShowsThroughputCapacity(subtype)) {
        const trimmed = throughputCapacity.trim();
        const val = trimmed === '' ? null : Number(trimmed.replace(',', '.'));
        const unit = defaultCapacityUnitForSubtype(subtype);
        props = mergeThroughputCapacity(
          props,
          val != null && !Number.isNaN(val) && val >= 0 ? val : null,
          unit
        );
      }
      payload.properties = props;

      if (isLineSubtype(subtype)) {
        const lineCoords = getLineCoordinates(selection.object);
        if (lineCoords) {
          const coords = lineCoords.map((c) => [...c] as [number, number]);
          coords[0] = [parseCoord(lon), parseCoord(lat)];
          payload.coordinates = coords;
          payload.lon = coords[0][0];
          payload.lat = coords[0][1];
          payload.end_lon = coords[coords.length - 1][0];
          payload.end_lat = coords[coords.length - 1][1];
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
  };

  return (
    <div
      className="object-detail-panel absolute top-3 right-3 z-20 w-[min(300px,calc(100%-1.5rem))] max-h-[min(70vh,420px)] flex flex-col rounded-lg border shadow-lg overflow-hidden"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      role="dialog"
      aria-label={title}
    >
      <div
        className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <span className="font-medium text-xs truncate">{title}</span>
        <button
          type="button"
          className="btn btn-ghost btn-icon-touch p-0.5 shrink-0"
          onClick={onClose}
          title="Закрыть"
          aria-label="Закрыть"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 text-xs">
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
            <label className="flex flex-col gap-0.5 mb-1.5">
              <span style={{ color: 'var(--text-muted)' }}>Название</span>
              <input
                className="input text-xs py-1"
                value={name}
                readOnly={readOnly}
                disabled={readOnly}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-0.5 mb-1.5">
              <span style={{ color: 'var(--text-muted)' }}>Подтип</span>
              <AppSelect
                variant="compact"
                value={subtype}
                readOnly={readOnly || subtypeLocked}
                onChange={setSubtype}
                options={infraSubtypeOptions}
              />
            </label>
            {layers.length > 0 && (
              <label className="flex flex-col gap-0.5 mb-1.5">
                <span style={{ color: 'var(--text-muted)' }}>Слой</span>
                <AppSelect
                  variant="compact"
                  value={layerId}
                  readOnly={readOnly}
                  onChange={setLayerId}
                  options={layers.map((l) => ({ value: l.id, label: l.name }))}
                />
              </label>
            )}
            <div className="grid grid-cols-2 gap-1.5 mb-1.5">
              <label className="flex flex-col gap-0.5">
                <span style={{ color: 'var(--text-muted)' }}>Долгота</span>
                <input
                  className="input text-xs py-1"
                  value={lon}
                  step="0.001"
                  readOnly={readOnly}
                  disabled={readOnly}
                  onChange={(e) => setLon(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span style={{ color: 'var(--text-muted)' }}>Широта</span>
                <input
                  className="input text-xs py-1"
                  value={lat}
                  step="0.001"
                  readOnly={readOnly}
                  disabled={readOnly}
                  onChange={(e) => setLat(e.target.value)}
                />
              </label>
            </div>
            {showThroughputCapacity && (
              <label className="flex flex-col gap-0.5 mb-1.5">
                <span style={{ color: 'var(--text-muted)' }}>
                  Пропускная способность ({capacityUnit})
                </span>
                <DeferredNumberInput
                  allowEmpty
                  min={0}
                  className="input text-xs py-1"
                  placeholder="—"
                  value={throughputCapacity}
                  readOnly={readOnly}
                  disabled={readOnly}
                  onCommit={(v) => setThroughputCapacity(v === '' ? '' : String(v))}
                />
              </label>
            )}
            <label className="flex flex-col gap-0.5">
              <span style={{ color: 'var(--text-muted)' }}>Описание</span>
              <textarea
                className="input text-xs min-h-[40px] py-1"
                value={description}
                readOnly={readOnly}
                disabled={readOnly}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
          </>
        )}
      </div>

      {readOnly ? (
        <p className="text-[10px] px-2 py-1.5 border-t shrink-0" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          Включите режим «Редактирование» на панели инструментов карты, чтобы изменять объект.
        </p>
      ) : (
        <div className="flex gap-1.5 p-2 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
          <button
            type="button"
            className="btn btn-primary flex-1 text-xs py-1 min-h-[30px] justify-center"
            disabled={saving}
            onClick={handleSave}
          >
            Сохранить
          </button>
          <button
            type="button"
            className="btn btn-secondary flex-1 text-xs py-1 min-h-[30px] justify-center"
            disabled={saving}
            onClick={onDelete}
          >
            Удалить
          </button>
        </div>
      )}
    </div>
  );
}
