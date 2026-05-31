import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calculator,
  Copy,
  FileText,
  Settings2,
  Trash2,
  Truck,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { coordForSave, formatCoord, parseCoord } from '../lib/coords';
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
import { formValuesToPoiPayload, poiToFormValues, type PoiFormValues, type PoiSectionId } from '../lib/poiParams';
import { useAppStore } from '../store';
import {
  capacityUnitLabel,
  defaultCapacityUnitForSubtype,
  effectiveThroughputCapacity,
  mergeThroughputCapacity,
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
import {
  RENDER_3D_BASE_KEY,
  RENDER_3D_HEIGHT_KEY,
  RENDER_3D_MODEL_ID_KEY,
  RENDER_3D_STYLE_KEY,
  RENDER_3D_VISIBLE_KEY,
  resolveRender3D,
} from '../lib/map3d/render3d';
import { catalogEntryForSubtype } from '../lib/map3d/map3dModelCatalog';
import { AppSelect } from './AppSelect';
import { DeferredNumberInput } from './DeferredNumberInput';
import { PoiParamsForm } from './PoiParamsForm';

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
  deleteDisabled?: boolean;
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

type InfraDetailTab = 'main' | 'logistics' | 'extra';
type PoiDetailTab = 'basic' | 'engineering' | 'calculation';

const POI_TAB_SECTIONS: Record<PoiDetailTab, PoiSectionId[]> = {
  basic: ['basic'],
  engineering: ['engineering'],
  calculation: ['thresholds', 'km_per_pad', 'max_total_line'],
};

const POI_TAB_FIELDS: Record<PoiDetailTab, (keyof PoiFormValues)[]> = {
  basic: [
    'name',
    'description',
    'lon',
    'lat',
    'fluid_type',
    'planned_production_volume',
    'water_injection_volume',
    'gas_factor',
    'production_per_well',
    'wells_per_pad',
  ],
  engineering: [
    'eng_power',
    'eng_injection',
    'eng_gas',
    'eng_oil_preparation',
    'eng_well_gathering',
    'eng_transport',
  ],
  calculation: [
    'threshold_gas_processing_km',
    'threshold_gtes_km',
    'threshold_substation_km',
    'threshold_refinery_km',
    'km_per_pad_autoroad',
    'km_per_pad_oil_pipeline',
    'km_per_pad_gas_pipeline',
    'km_per_pad_water_pipeline',
    'km_per_pad_power_line',
    'max_total_line_autoroad_km',
    'max_total_line_oil_pipeline_km',
    'max_total_line_gas_pipeline_km',
    'max_total_line_water_pipeline_km',
    'max_total_line_power_line_km',
  ],
};

const POI_TAB_LABELS: Record<PoiDetailTab, string> = {
  basic: 'Основное',
  engineering: 'Инженерия',
  calculation: 'Расчёт',
};

const INFRA_TAB_ICONS: Record<InfraDetailTab, LucideIcon> = {
  main: Settings2,
  logistics: Truck,
  extra: FileText,
};

const POI_TAB_ICONS: Record<PoiDetailTab, LucideIcon> = {
  basic: Settings2,
  engineering: Wrench,
  calculation: Calculator,
};

function pickPoiFields(v: PoiFormValues, keys: (keyof PoiFormValues)[]): Partial<PoiFormValues> {
  return Object.fromEntries(keys.map((key) => [key, v[key]])) as Partial<PoiFormValues>;
}

function capacityDraftFromObject(object: InfraObject): number | '' {
  const eff = effectiveThroughputCapacity(object.subtype, object.properties);
  return eff.value != null ? eff.value : '';
}

function DetailPanelTabs<T extends string>({
  tabs,
  active,
  onChange,
  tabDirty,
  ariaLabel,
}: {
  tabs: { id: T; label: string; icon: LucideIcon }[];
  active: T;
  onChange: (id: T) => void;
  tabDirty?: (id: T) => boolean;
  ariaLabel: string;
}) {
  if (tabs.length <= 1) return null;

  return (
    <div className="object-detail-panel__tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        const dirty = tabDirty?.(tab.id);
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={tab.label}
            title={tab.label}
            className={`object-detail-panel__tab${isActive ? ' object-detail-panel__tab--active' : ''}${
              dirty ? ' object-detail-panel__tab--dirty' : ''
            }`}
            onClick={() => onChange(tab.id)}
          >
            <Icon size={15} strokeWidth={2} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

export function ObjectDetailPanel({
  selection,
  layers,
  onSave,
  onDelete,
  onClose,
  saving,
  readOnly = false,
  deleteDisabled = false,
}: ObjectDetailPanelProps) {
  const pushToast = useAppStore((s) => s.pushToast);
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
  const [capacityValue, setCapacityValue] = useState<number | ''>('');
  const [render3dHeight, setRender3dHeight] = useState('');
  const [render3dBase, setRender3dBase] = useState('');
  const [render3dVisible, setRender3dVisible] = useState(true);
  const [render3dStyle, setRender3dStyle] = useState('');
  const [render3dModelId, setRender3dModelId] = useState('');
  const [infraTab, setInfraTab] = useState<InfraDetailTab>('main');
  const [poiTab, setPoiTab] = useState<PoiDetailTab>('basic');

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
    setCapacityValue(capacityDraftFromObject(o));
    const r3 = resolveRender3D(o.subtype, o.properties);
    setRender3dHeight(String(r3.heightM));
    setRender3dBase(String(r3.baseM));
    setRender3dVisible(r3.visible);
    const style = o.properties?.[RENDER_3D_STYLE_KEY];
    setRender3dStyle(typeof style === 'string' ? style : '');
    const modelId = o.properties?.[RENDER_3D_MODEL_ID_KEY];
    setRender3dModelId(typeof modelId === 'string' ? modelId : '');
    setInfraTab('main');
    setPoiTab('basic');
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
      if (pointShowsThroughputCapacity(subtype) && !isLineSubtype(subtype)) {
        const capacity = capacityValue === '' ? null : capacityValue;
        props = mergeThroughputCapacity(props, capacity, defaultCapacityUnitForSubtype(subtype));
      }
      const h = render3dHeight.trim() ? parseFloat(render3dHeight) : null;
      const b = render3dBase.trim() ? parseFloat(render3dBase) : null;
      if (h != null && Number.isFinite(h) && h >= 0) props[RENDER_3D_HEIGHT_KEY] = h;
      if (b != null && Number.isFinite(b) && b >= 0) props[RENDER_3D_BASE_KEY] = b;
      props[RENDER_3D_VISIBLE_KEY] = render3dVisible;
      if (!isLineSubtype(subtype)) {
        if (render3dStyle === 'model' || render3dStyle === 'extrusion') {
          props[RENDER_3D_STYLE_KEY] = render3dStyle;
        } else {
          delete props[RENDER_3D_STYLE_KEY];
        }
        const mid = render3dModelId.trim();
        if (mid) props[RENDER_3D_MODEL_ID_KEY] = mid;
        else delete props[RENDER_3D_MODEL_ID_KEY];
      }
      payload.properties = props;

      const o = selection.object;
      const saveLon = coordForSave(parseCoord(lon), o.lon, lon);
      const saveLat = coordForSave(parseCoord(lat), o.lat, lat);

      if (isLineSubtype(subtype)) {
        const coords = getLineCoordinates(o);
        if (coords) {
          const next = coords.map((c) => [...c] as [number, number]);
          next[0] = [saveLon, saveLat];
          payload.coordinates = next;
          payload.lon = next[0][0];
          payload.lat = next[0][1];
          payload.end_lon = next[next.length - 1][0];
          payload.end_lat = next[next.length - 1][1];
        } else {
          payload.lon = saveLon;
          payload.lat = saveLat;
        }
      } else {
        payload.lon = saveLon;
        payload.lat = saveLat;
      }
    } else {
      const poi = selection.poi;
      payload.lon = coordForSave(parseCoord(lon), poi.lon, lon);
      payload.lat = coordForSave(parseCoord(lat), poi.lat, lat);
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
    capacityValue,
    render3dHeight,
    render3dBase,
    render3dVisible,
    render3dStyle,
    render3dModelId,
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
    const capacityDirty =
      pointShowsThroughputCapacity(infraObject.subtype) &&
      !isLine &&
      capacityValue !== capacityDraftFromObject(infraObject);
    const origR3 = resolveRender3D(infraObject.subtype, infraObject.properties);
    const origStyle = (infraObject.properties?.[RENDER_3D_STYLE_KEY] as string) || '';
    const origModelId = (infraObject.properties?.[RENDER_3D_MODEL_ID_KEY] as string) || '';
    const r3Dirty =
      render3dHeight !== String(origR3.heightM) ||
      render3dBase !== String(origR3.baseM) ||
      render3dVisible !== origR3.visible ||
      render3dStyle !== origStyle ||
      render3dModelId !== origModelId;
    return (
      name !== infraObject.name ||
      description !== origDesc ||
      subtype !== infraObject.subtype ||
      layerId !== infraObject.layer_id ||
      lon !== formatCoord(infraObject.lon) ||
      lat !== formatCoord(infraObject.lat) ||
      sandDirty ||
      entryDirty ||
      capacityDirty ||
      r3Dirty
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
    capacityValue,
    render3dHeight,
    render3dBase,
    render3dVisible,
  ]);

  const capacityUnit =
    throughputCapacity?.unit || defaultCapacityUnitForSubtype(subtype);

  const showLogisticsTab = showSandQuarryFields || showSandDemandField;

  const infraTabs = useMemo(() => {
    const tabs: { id: InfraDetailTab; label: string; icon: LucideIcon }[] = [
      { id: 'main', label: 'Основное', icon: INFRA_TAB_ICONS.main },
    ];
    if (showLogisticsTab) {
      tabs.push({ id: 'logistics', label: 'Логистика', icon: INFRA_TAB_ICONS.logistics });
    }
    tabs.push({ id: 'extra', label: 'Дополнительно', icon: INFRA_TAB_ICONS.extra });
    return tabs;
  }, [showLogisticsTab]);

  useEffect(() => {
    if (!infraTabs.some((t) => t.id === infraTab)) {
      setInfraTab('main');
    }
  }, [infraTabs, infraTab]);

  const poiTabs = useMemo(
    () =>
      (['basic', 'engineering', 'calculation'] as const).map((id) => ({
        id,
        label: POI_TAB_LABELS[id],
        icon: POI_TAB_ICONS[id],
      })),
    [],
  );

  const infraTabDirty = useCallback(
    (tab: InfraDetailTab): boolean => {
      if (readOnly || !infraObject) return false;
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
      const mainDirty =
        subtype !== infraObject.subtype ||
        layerId !== infraObject.layer_id ||
        lon !== formatCoord(infraObject.lon) ||
        lat !== formatCoord(infraObject.lat) ||
        entryDirty ||
        (pointShowsThroughputCapacity(infraObject.subtype) &&
          !isLine &&
          capacityValue !== capacityDraftFromObject(infraObject));
      switch (tab) {
        case 'main':
          return mainDirty;
        case 'logistics':
          return sandDirty;
        case 'extra': {
          const origR3 = resolveRender3D(infraObject.subtype, infraObject.properties);
          const origStyle = (infraObject.properties?.[RENDER_3D_STYLE_KEY] as string) || '';
          const origModelId = (infraObject.properties?.[RENDER_3D_MODEL_ID_KEY] as string) || '';
          const r3Dirty =
            render3dHeight !== String(origR3.heightM) ||
            render3dBase !== String(origR3.baseM) ||
            render3dVisible !== origR3.visible ||
            render3dStyle !== origStyle ||
            render3dModelId !== origModelId;
          return description !== origDesc || r3Dirty;
        }
        default:
          return false;
      }
    },
    [
      readOnly,
      infraObject,
      isLine,
      render3dHeight,
      render3dBase,
      render3dVisible,
      render3dStyle,
      render3dModelId,
      sandInitialM3,
      sandCurrentM3,
      sandDemandM3,
      entryDate,
      subtype,
      layerId,
      lon,
      lat,
      description,
      capacityValue,
    ],
  );

  const poiTabDirty = useCallback(
    (tab: PoiDetailTab): boolean => {
      if (readOnly || !isPoi || !poiForm || selection.kind !== 'poi') return false;
      const orig = poiToFormValues(selection.poi);
      const keys = POI_TAB_FIELDS[tab];
      return JSON.stringify(pickPoiFields(poiForm, keys)) !== JSON.stringify(pickPoiFields(orig, keys));
    },
    [readOnly, isPoi, poiForm, selection],
  );

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

      {isPoi && poiForm ? (
        <DetailPanelTabs
          tabs={poiTabs}
          active={poiTab}
          onChange={setPoiTab}
          tabDirty={poiTabDirty}
          ariaLabel="Параметры точки интереса"
        />
      ) : (
        <DetailPanelTabs
          tabs={infraTabs}
          active={infraTab}
          onChange={setInfraTab}
          tabDirty={infraTabDirty}
          ariaLabel="Параметры объекта"
        />
      )}

      <div className="object-detail-panel__body">
        {isPoi && poiForm ? (
          <PoiParamsForm
            value={poiForm}
            onChange={setPoiForm}
            defaults={defaults}
            readOnly={readOnly}
            coordsReadOnly={readOnly}
            flat
            sections={POI_TAB_SECTIONS[poiTab]}
          />
        ) : (
          <>
            {infraTab === 'main' && (
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
            )}

            {infraTab === 'logistics' && (
              <>
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
              </>
            )}

            {infraTab === 'extra' && (
              <>
                <PanelSection title="Отображение в 3D">
                  <label className="object-detail-panel__field">
                    <FieldLabel>Высота (м)</FieldLabel>
                    <input
                      className="input object-detail-panel__input"
                      type="number"
                      min={0}
                      step="any"
                      value={render3dHeight}
                      readOnly={readOnly}
                      disabled={readOnly}
                      onChange={(e) => setRender3dHeight(e.target.value)}
                    />
                  </label>
                  <label className="object-detail-panel__field">
                    <FieldLabel>Основание над рельефом (м)</FieldLabel>
                    <input
                      className="input object-detail-panel__input"
                      type="number"
                      min={0}
                      step="any"
                      value={render3dBase}
                      readOnly={readOnly}
                      disabled={readOnly}
                      onChange={(e) => setRender3dBase(e.target.value)}
                    />
                  </label>
                  <label className="object-detail-panel__field object-detail-panel__field--row">
                    <FieldLabel>Видимость в 3D</FieldLabel>
                    <input
                      type="checkbox"
                      checked={render3dVisible}
                      disabled={readOnly}
                      onChange={(e) => setRender3dVisible(e.target.checked)}
                    />
                  </label>
                  {infraObject && !isLineSubtype(infraObject.subtype) && catalogEntryForSubtype(infraObject.subtype) ? (
                    <>
                      <label className="object-detail-panel__field">
                        <FieldLabel>Стиль 3D</FieldLabel>
                        <select
                          className="input object-detail-panel__input"
                          value={render3dStyle}
                          disabled={readOnly}
                          onChange={(e) => setRender3dStyle(e.target.value)}
                        >
                          <option value="">Модель (по умолчанию)</option>
                          <option value="model">Модель</option>
                          <option value="extrusion">Столбик (extrusion)</option>
                        </select>
                      </label>
                      <label className="object-detail-panel__field">
                        <FieldLabel>ID модели (опционально)</FieldLabel>
                        <input
                          className="input object-detail-panel__input"
                          type="text"
                          value={render3dModelId}
                          placeholder="facility, stack, node, quarry, poi_pin"
                          readOnly={readOnly}
                          disabled={readOnly}
                          onChange={(e) => setRender3dModelId(e.target.value)}
                        />
                      </label>
                    </>
                  ) : null}
                </PanelSection>
                <label className="object-detail-panel__field">
                  <FieldLabel>Описание</FieldLabel>
                  <textarea
                    className="input object-detail-panel__textarea"
                    value={description}
                    rows={5}
                    placeholder="Комментарий к объекту…"
                    readOnly={readOnly}
                    disabled={readOnly}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>
              </>
            )}
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
              disabled={saving || deleteDisabled}
              onClick={onDelete}
              title={
                deleteDisabled
                  ? 'Удаление недоступно'
                  : 'Удалить объект'
              }
            >
              <Trash2 size={15} />
              Удалить
            </button>
          </>
        )}
      </footer>
    </div>
  );
}
