import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText } from 'lucide-react';
import { AppSelect } from '../components/AppSelect';
import { MapView, type MapFocusTarget } from '../components/MapView';
import { engLabel } from '../lib/poiParams';
import { api, normalizePoiAnalysisResponse, type InfraLayer, type InfraObject, type POI } from '../lib/api';
import {
  alignAnalysisRowsToMapObjects,
  buildMapFocusForConnectionLines,
  connectionLinesFromAnalysis,
} from '../lib/analysisDisplay';
import { loadMapViewState } from '../lib/mapViewState';
import { useAppStore } from '../store';

const ROADMAP = [
  { phase: 'Разведка', months: '0–6', status: 'done' },
  { phase: 'ПИР', months: '6–12', status: 'done' },
  { phase: 'Изыскания', months: '12–18', status: 'active' },
  { phase: 'Бурение', months: '18–30', status: 'pending' },
  { phase: 'Строительство', months: '24–36', status: 'pending' },
  { phase: 'Эксплуатация', months: '36+', status: 'pending' },
];

const EMPTY_POIS: POI[] = [];
const EMPTY_LAYERS: InfraLayer[] = [];
const EMPTY_INFRA: InfraObject[] = [];

export function ReportPage() {
  const projectId = useAppStore((s) => s.currentProjectId);
  const [selectedPoiId, setSelectedPoiId] = useState('');
  const [mapFocus, setMapFocus] = useState<MapFocusTarget | null>(null);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.getProject(projectId!),
    enabled: !!projectId,
  });

  useEffect(() => {
    setSelectedPoiId('');
  }, [projectId]);

  const { data: pois = EMPTY_POIS } = useQuery({
    queryKey: ['pois', projectId],
    queryFn: () => api.getPois(projectId!),
    enabled: !!projectId,
  });

  const { data: infraObjects = EMPTY_INFRA } = useQuery({
    queryKey: ['infra', projectId],
    queryFn: () => api.getInfraObjects(projectId!),
    enabled: !!projectId,
  });

  const { data: layers = EMPTY_LAYERS } = useQuery({
    queryKey: ['layers', projectId],
    queryFn: () => api.getLayers(projectId!),
    enabled: !!projectId,
  });

  const activePoiId = selectedPoiId || pois[0]?.id || '';
  const selectedPoi = pois.find((p) => p.id === activePoiId) ?? pois[0] ?? null;

  useEffect(() => {
    if (pois.length === 0) {
      if (selectedPoiId) setSelectedPoiId('');
      return;
    }
    if (!selectedPoiId || !pois.some((p) => p.id === selectedPoiId)) {
      setSelectedPoiId(pois[0].id);
    }
  }, [pois, selectedPoiId]);

  const { data: analysisData } = useQuery({
    queryKey: ['analysis', projectId, selectedPoi?.id],
    queryFn: async () => {
      const raw = await api.getPoiAnalysis(projectId!, selectedPoi!.id);
      return normalizePoiAnalysisResponse(raw);
    },
    enabled: !!projectId && !!selectedPoi?.id,
    retry: false,
  });

  const visibleLayerIds = useMemo(
    () => new Set(layers.filter((l) => l.is_visible).map((l) => l.id)),
    [layers]
  );

  const mapLayerVisibleInfra = useMemo(
    () => infraObjects.filter((o) => visibleLayerIds.has(o.layer_id)),
    [infraObjects, visibleLayerIds]
  );

  const alignedAnalysisRows = useMemo(
    () => alignAnalysisRowsToMapObjects(analysisData?.rows ?? [], mapLayerVisibleInfra),
    [analysisData?.rows, mapLayerVisibleInfra]
  );

  const connectionLines = useMemo(
    () => connectionLinesFromAnalysis(alignedAnalysisRows, mapLayerVisibleInfra),
    [alignedAnalysisRows, mapLayerVisibleInfra]
  );

  const connectionLinesKey = useMemo(
    () =>
      connectionLines
        .map(
          (r) =>
            `${r.subtype}:${r.nearest_object_id ?? ''}:${r.anchor_lon ?? ''},${r.anchor_lat ?? ''}`
        )
        .join(';'),
    [connectionLines]
  );

  const mapFocusInputRef = useRef({ connectionLines, mapLayerVisibleInfra });
  mapFocusInputRef.current = { connectionLines, mapLayerVisibleInfra };

  useEffect(() => {
    if (!selectedPoi || !projectId) {
      setMapFocus(null);
      return;
    }
    if (loadMapViewState('report', projectId, selectedPoi.id)) {
      setMapFocus(null);
      return;
    }
    const { connectionLines: lines, mapLayerVisibleInfra: visibleInfra } = mapFocusInputRef.current;
    const focus = buildMapFocusForConnectionLines(
      { lon: selectedPoi.lon, lat: selectedPoi.lat },
      lines,
      visibleInfra
    );
    const focusKey = `${selectedPoi.id}:${connectionLinesKey}:${focus.lon},${focus.lat}`;
    setMapFocus((prev) => {
      if (prev?.focusKey === focusKey) return prev;
      return { ...focus, nonce: Date.now(), focusKey };
    });
  }, [selectedPoi?.id, selectedPoi?.lon, selectedPoi?.lat, projectId, connectionLinesKey]);

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-title-block">
          <h1 className="page-title">Одностраничник</h1>
          <p className="page-subtitle">Отчёт для руководства (FR-11)</p>
        </div>
        <div className="page-toolbar-actions">
          {pois.length > 0 && (
            <AppSelect
              variant="sm"
              ariaLabel="Точка интереса для отчёта"
              value={activePoiId}
              onChange={setSelectedPoiId}
              options={pois.map((poi) => ({ value: poi.id, label: poi.name }))}
            />
          )}
          <button type="button" className="btn btn-secondary" disabled={!selectedPoi}>
            <Download size={16} /> PDF
          </button>
          <button type="button" className="btn btn-secondary" disabled={!selectedPoi}>
            <FileText size={16} /> PPTX
          </button>
        </div>
      </div>

      {!projectId ? (
        <div className="card text-sm" style={{ color: 'var(--text-muted)' }}>
          Выберите проект в шапке приложения.
        </div>
      ) : pois.length === 0 ? (
        <div className="card text-sm" style={{ color: 'var(--text-muted)' }}>
          В проекте нет точек интереса. Добавьте POI на карте.
        </div>
      ) : (
      <div className="card max-w-4xl mx-auto" id="report-content">
        <div className="text-center mb-6 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-xl font-bold">
            {project?.name ?? 'Проект'}
            {selectedPoi ? ` — ${selectedPoi.name}` : ''}
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {analysisData?.total_cost_mln != null
              ? `${analysisData.total_cost_mln} млн ₽`
              : 'Стоимость не рассчитана'}
            {' · '}
            {new Date().toLocaleDateString('ru-RU')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="font-semibold mb-2">Карта подключений</h3>
            <div className="report-map-preview">
            <MapView
              viewStateId="report"
              viewStateScope={selectedPoi?.id ?? null}
              pois={pois}
              infraObjects={infraObjects}
              selectedPoi={selectedPoi}
              connectionLines={connectionLines}
              mapFocus={mapFocus}
              height="220px"
              useMapIcons
              layers={layers}
            />
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Ключевые показатели</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Общая стоимость</span>
                <strong>
                  {analysisData?.total_cost_mln != null
                    ? `${analysisData.total_cost_mln} млн ₽`
                    : '—'}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Кустовые площадки</span>
                <strong>{selectedPoi ? `${selectedPoi.pads_count} шт.` : '—'}</strong>
              </div>
              <div className="flex justify-between">
                <span>Электроснабжение</span>
                <strong>{selectedPoi ? engLabel('eng_power', selectedPoi.eng_power) : '—'}</strong>
              </div>
              <div className="flex justify-between">
                <span>Подготовка нефти</span>
                <strong>{selectedPoi ? engLabel('eng_oil_preparation', selectedPoi.eng_oil_preparation) : '—'}</strong>
              </div>
              <div className="flex justify-between">
                <span>Транспортировка</span>
                <strong>{selectedPoi ? engLabel('eng_transport', selectedPoi.eng_transport) : '—'}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="font-semibold mb-3">Дорожная карта (диаграмма Ганта)</h3>
          <div className="border rounded-lg p-3 text-xs" style={{ borderColor: 'var(--border)' }}>
            <div className="flex justify-between mb-1" style={{ color: 'var(--text-muted)' }}>
              <span>Месяцы</span>
              <span>0</span>
              <span>12</span>
              <span>24</span>
              <span>36+</span>
            </div>
            <div className="space-y-2">
              {ROADMAP.map((step) => {
                const [startStr, endStr] = step.months.split('–');
                const start = parseInt(startStr, 10) || 0;
                const end = endStr?.includes('+') ? 42 : parseInt(endStr, 10) || start + 6;
                const duration = Math.max(end - start, 3);
                const left = (start / 42) * 100;
                const width = (duration / 42) * 100;
                const baseClass =
                  step.status === 'done'
                    ? 'bg-green-500'
                    : step.status === 'active'
                      ? 'bg-blue-500'
                      : 'bg-gray-400';
                return (
                  <div key={step.phase} className="flex items-center gap-2">
                    <div className="w-28 shrink-0">
                      <div className="font-medium">{step.phase}</div>
                      <div className="opacity-70">{step.months} мес.</div>
                    </div>
                    <div className="relative flex-1 h-4 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`${baseClass} h-full rounded-full`}
                        style={{ marginLeft: `${left}%`, width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg" style={{ background: 'var(--bg)' }}>
          <h3 className="font-semibold mb-2">Рекомендация</h3>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Рекомендуется реализация по Сценарию 2: внутреннее электроснабжение (ГТЭС),
            локальная закачка, подготовка нефти на МКОС, транспортировка через магистральный
            нефтепровод. Все пороговые расстояния соблюдены. Общая стоимость — 3055 млн ₽.
          </p>
        </div>
      </div>
      )}
    </div>
  );
}
