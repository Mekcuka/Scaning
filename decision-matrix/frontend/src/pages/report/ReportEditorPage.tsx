import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, FileText, Save, Sparkles } from 'lucide-react';
import { AppSelect } from '../../components/AppSelect';
import {
  alignAnalysisRowsToMapObjects,
  buildAnalysisResultMapFocus,
  buildMapFocusForConnectionLines,
  connectionLinesFromAnalysis,
} from '../../lib/analysisDisplay';
import {
  api,
  normalizePoiAnalysisResponse,
  type AnalysisRow,
  type InfraLayer,
  type InfraObject,
  type OnePager,
  type OnePagerRoadmapStage,
  type POI,
} from '../../lib/api';
import { captureMapSnapshot, downloadBlob } from '../../lib/mapSnapshot';
import { engLabel } from '../../lib/poiParams';
import { useActiveProject } from '../../hooks/useActiveProject';
import {
  useProjectInfraObjects,
  useProjectLayers,
  useProjectPois,
} from '../../hooks/useProjectData';
import { useAppStore } from '../../store';
import { usePermissions } from '../../hooks/usePermissions';
import { OnePagerPreview, type OnePagerPreviewData } from './components/OnePagerPreview';
import { DEFAULT_ROADMAP } from './reportUtils';
import type { MapFocusTarget } from '../../components/MapView';

const EMPTY_POIS: POI[] = [];
const EMPTY_LAYERS: InfraLayer[] = [];
const EMPTY_INFRA: InfraObject[] = [];

function buildDefaultRecommendation(
  poi: POI,
  totalMln: number | null | undefined,
  exceedCount: number
): string {
  const total = totalMln != null ? `${totalMln} млн ₽` : '—';
  const eng = [
    engLabel('eng_power', poi.eng_power),
    engLabel('eng_injection', poi.eng_injection),
    engLabel('eng_gas', poi.eng_gas),
    engLabel('eng_oil_preparation', poi.eng_oil_preparation),
    engLabel('eng_transport', poi.eng_transport),
  ].join(', ');
  return (
    `Рекомендуется реализация по точке «${poi.name}»: ${eng}. ` +
    `Общая стоимость — ${total}. Превышений: ${exceedCount}.`
  );
}

export function ReportEditorPage({ mode }: { mode: 'new' | 'edit' }) {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { projectId } = useActiveProject();
  const { canWriteProject } = usePermissions();
  const readOnly = !canWriteProject;
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const previewRef = useRef<HTMLDivElement>(null);

  const [selectedPoiId, setSelectedPoiId] = useState('');
  const [roadmap, setRoadmap] = useState<OnePagerRoadmapStage[]>(DEFAULT_ROADMAP);
  const [recommendationText, setRecommendationText] = useState('');
  const [mapFocus, setMapFocus] = useState<MapFocusTarget | null>(null);

  const { data: authUser } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.me(),
  });

  const { data: saved, isLoading: loadingSaved } = useQuery({
    queryKey: ['one-pager', projectId, id],
    queryFn: () => api.getOnePager(projectId!, id!),
    enabled: mode === 'edit' && !!projectId && !!id,
  });

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.getProject(projectId!),
    enabled: !!projectId,
  });

  const { data: pois = EMPTY_POIS } = useProjectPois(projectId);
  const { data: infraObjects = EMPTY_INFRA } = useProjectInfraObjects(projectId);
  const { data: layers = EMPTY_LAYERS } = useProjectLayers(projectId);

  useEffect(() => {
    if (mode !== 'new' || pois.length === 0) return;
    const qp = searchParams.get('poi');
    setSelectedPoiId((prev) => {
      if (prev && pois.some((p) => p.id === prev)) return prev;
      if (qp && pois.some((p) => p.id === qp)) return qp;
      return pois[0].id;
    });
  }, [mode, pois, searchParams]);

  useEffect(() => {
    if (mode === 'edit' && saved) {
      setSelectedPoiId(saved.poi_id);
      setRoadmap(saved.roadmap?.length ? saved.roadmap : DEFAULT_ROADMAP);
      setRecommendationText(saved.recommendation_text ?? '');
    }
  }, [mode, saved]);

  const activePoiId = mode === 'edit' && saved ? saved.poi_id : selectedPoiId;
  const selectedPoi = pois.find((p) => p.id === activePoiId) ?? null;

  const { data: liveAnalysis } = useQuery({
    queryKey: ['analysis', projectId, activePoiId],
    queryFn: async () => normalizePoiAnalysisResponse(await api.getPoiAnalysis(projectId!, activePoiId)),
    enabled: !!projectId && !!activePoiId,
    retry: false,
  });

  const analysisRows: AnalysisRow[] = useMemo(() => {
    if (mode === 'edit' && saved) {
      const fd = saved.final_variant_data as { analysis_rows?: AnalysisRow[] };
      const raw = fd.analysis_rows ?? [];
      if (raw.length === 0) return liveAnalysis?.rows ?? [];
      return normalizePoiAnalysisResponse({
        poi_id: saved.poi_id,
        total_cost_mln: 0,
        overall_status: '',
        analysis: raw as unknown as Array<Record<string, unknown>>,
        engineering_status: {},
      }).rows;
    }
    return liveAnalysis?.rows ?? [];
  }, [mode, saved, liveAnalysis?.rows]);

  const mapAnalysisRows: AnalysisRow[] = useMemo(() => {
    if (liveAnalysis?.rows?.length) return liveAnalysis.rows;
    return analysisRows;
  }, [liveAnalysis?.rows, analysisRows]);

  const totalCostMln = useMemo(() => {
    if (mode === 'edit' && saved) {
      const fd = saved.final_variant_data as { total_cost_mln?: number };
      return fd.total_cost_mln ?? null;
    }
    return liveAnalysis?.total_cost_mln ?? null;
  }, [mode, saved, liveAnalysis?.total_cost_mln]);

  const equipmentCostMln = useMemo(() => {
    if (mode === 'edit' && saved) {
      const fd = saved.final_variant_data as { equipment_cost_mln?: number };
      return fd.equipment_cost_mln ?? null;
    }
    const raw = liveAnalysis as { equipment_cost_mln?: number } | undefined;
    return typeof raw?.equipment_cost_mln === 'number' ? raw.equipment_cost_mln : null;
  }, [mode, saved, liveAnalysis]);

  useEffect(() => {
    if (mode !== 'new' || !selectedPoi) return;
    if (recommendationText) return;
    const exceed = analysisRows.filter((r) => r.status === 'exceeds_limit').length;
    setRecommendationText(buildDefaultRecommendation(selectedPoi, totalCostMln, exceed));
  }, [mode, selectedPoi, analysisRows, totalCostMln, recommendationText]);

  const visibleLayerIds = useMemo(
    () => new Set(layers.filter((l) => l.is_visible).map((l) => l.id)),
    [layers]
  );
  const mapLayerVisibleInfra = useMemo(
    () => infraObjects.filter((o) => visibleLayerIds.has(o.layer_id)),
    [infraObjects, visibleLayerIds]
  );
  const alignedAnalysisRows = useMemo(
    () => alignAnalysisRowsToMapObjects(mapAnalysisRows, mapLayerVisibleInfra),
    [mapAnalysisRows, mapLayerVisibleInfra]
  );
  const connectionLines = useMemo(
    () => connectionLinesFromAnalysis(alignedAnalysisRows, mapLayerVisibleInfra),
    [alignedAnalysisRows, mapLayerVisibleInfra]
  );

  useEffect(() => {
    if (!selectedPoi || !projectId) {
      setMapFocus(null);
      return;
    }
    const lineFocus = buildMapFocusForConnectionLines(
      { lon: selectedPoi.lon, lat: selectedPoi.lat },
      connectionLines.length ? connectionLines : alignedAnalysisRows,
      mapLayerVisibleInfra
    );
    const resultFocus = buildAnalysisResultMapFocus(
      { lon: selectedPoi.lon, lat: selectedPoi.lat },
      alignedAnalysisRows
    );
    const focus = resultFocus ?? lineFocus;
    setMapFocus({ ...focus, nonce: Date.now() });
  }, [
    selectedPoi?.id,
    selectedPoi?.lon,
    selectedPoi?.lat,
    projectId,
    connectionLines,
    alignedAnalysisRows,
    mapLayerVisibleInfra,
  ]);

  const previewData: OnePagerPreviewData = useMemo(() => {
    const title =
      mode === 'edit' && saved
        ? saved.title
        : `${project?.name ?? 'Проект'} — ${selectedPoi?.name ?? ''}`;
    return {
      title,
      coordinates:
        mode === 'edit' && saved
          ? saved.coordinates
          : selectedPoi
            ? `${selectedPoi.lat.toFixed(5)}, ${selectedPoi.lon.toFixed(5)}`
            : null,
      engineerName:
        mode === 'edit' && saved ? saved.engineer_name : authUser?.username ?? null,
      reportDate: mode === 'edit' && saved ? saved.report_date : null,
      poiName:
        mode === 'edit' && saved
          ? saved.poi_name ?? selectedPoi?.name
          : selectedPoi?.name,
      totalCostMln,
      equipmentCostMln,
      analysisRows,
      poi: selectedPoi,
      roadmap,
      recommendationText,
    };
  }, [
    mode,
    saved,
    project?.name,
    selectedPoi,
    authUser?.username,
    totalCostMln,
    equipmentCostMln,
    analysisRows,
    roadmap,
    recommendationText,
  ]);

  const handlePoiChange = (poiId: string) => {
    setSelectedPoiId(poiId);
    setRecommendationText('');
  };

  const hasAnalysis = analysisRows.length > 0;

  const createMut = useMutation({
    mutationFn: async () => {
      const mapRoot = previewRef.current?.querySelector('[data-map-capture-root]') as HTMLElement | null;
      const snapshot = captureMapSnapshot(mapRoot);
      return api.createOnePager(projectId!, {
        poi_id: activePoiId,
        engineer_name: authUser?.username,
        roadmap,
        recommendation_text: recommendationText,
        map_snapshot_base64: snapshot,
      });
    },
    onSuccess: (op: OnePager) => {
      queryClient.invalidateQueries({ queryKey: ['one-pagers', projectId] });
      pushToast('success', 'Одностраничник сформирован');
      navigate(`/report/${op.id}`, { replace: true });
    },
    onError: (e: Error) => pushToast('error', e.message),
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      const mapRoot = previewRef.current?.querySelector('[data-map-capture-root]') as HTMLElement | null;
      const snapshot = captureMapSnapshot(mapRoot);
      return api.updateOnePager(projectId!, id!, {
        recommendation_text: recommendationText,
        roadmap,
        map_snapshot_base64: snapshot,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['one-pager', projectId, id] });
      queryClient.invalidateQueries({ queryKey: ['one-pagers', projectId] });
      pushToast('success', 'Изменения сохранены');
    },
    onError: (e: Error) => pushToast('error', e.message),
  });

  const pptxMut = useMutation({
    mutationFn: async () => {
      const mapRoot = previewRef.current?.querySelector('[data-map-capture-root]') as HTMLElement | null;
      const snapshot = captureMapSnapshot(mapRoot);
      const blob = await api.exportOnePagerPptx(projectId!, id!, snapshot);
      downloadBlob(blob, `one-pager-${activePoiId.slice(0, 8)}.pptx`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['one-pager', projectId, id] });
      pushToast('success', 'PPTX скачан');
    },
    onError: (e: Error) => pushToast('error', e.message),
  });

  const handlePrint = () => window.print();

  useEffect(() => {
    if (searchParams.get('print') !== '1') return;
    const t = window.setTimeout(() => {
      window.print();
      searchParams.delete('print');
      setSearchParams(searchParams, { replace: true });
    }, 600);
    return () => window.clearTimeout(t);
  }, [searchParams, setSearchParams]);

  if (mode === 'edit' && loadingSaved) {
    return (
      <div className="card text-sm" style={{ color: 'var(--text-muted)' }}>
        Загрузка отчёта…
      </div>
    );
  }

  return (
    <div className="report-editor">
      <div className="page-toolbar no-print">
        <div className="page-title-block">
          <Link to="/report" className="btn btn-secondary btn-sm mb-2">
            <ArrowLeft size={14} /> К списку
          </Link>
          <h1 className="page-title">
            {mode === 'new' ? 'Новый одностраничник' : 'Одностраничник'}
          </h1>
        </div>
        <div className="page-toolbar-actions">
          {(mode === 'edit' || (mode === 'new' && hasAnalysis)) && (
            <>
              <button type="button" className="btn btn-secondary" onClick={handlePrint}>
                <Download size={16} /> PDF
              </button>
              {mode === 'edit' && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={pptxMut.isPending}
                  onClick={() => pptxMut.mutate()}
                >
                  <FileText size={16} /> PPTX
                </button>
              )}
            </>
          )}
          {!readOnly && mode === 'new' && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!activePoiId || !hasAnalysis || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              <Sparkles size={16} /> Сформировать отчёт
            </button>
          )}
          {!readOnly && mode === 'edit' && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={updateMut.isPending}
              onClick={() => updateMut.mutate()}
            >
              <Save size={16} /> Сохранить
            </button>
          )}
        </div>
      </div>

      {!projectId ? (
        <div className="card text-sm" style={{ color: 'var(--text-muted)' }}>
          Выберите проект в шапке приложения.
        </div>
      ) : pois.length === 0 ? (
        <div className="card text-sm" style={{ color: 'var(--text-muted)' }}>
          В проекте нет точек интереса.
        </div>
      ) : mode === 'new' ? (
        <>
          <div className="card report-setup-card no-print mb-4">
            <h2 className="report-setup-card__title">Параметры отчёта</h2>
            <p className="report-setup-card__hint text-sm" style={{ color: 'var(--text-muted)' }}>
              Выберите точку интереса, проверьте превью и нажмите «Сформировать отчёт».
            </p>
            <div className="report-setup-card__fields">
              <label className="report-setup-field">
                <span className="report-setup-field__label">Точка интереса</span>
                <AppSelect
                  variant="default"
                  fullWidth
                  ariaLabel="Точка интереса"
                  value={activePoiId}
                  onChange={handlePoiChange}
                  options={pois.map((p) => ({ value: p.id, label: p.name }))}
                />
              </label>
            </div>
            {!hasAnalysis && activePoiId && (
              <p className="text-sm mt-3" style={{ color: 'var(--warning, #b8860b)' }}>
                Нет данных анализа для выбранной точки. Выполните анализ окружения на карте или в матрице.
              </p>
            )}
          </div>
          {hasAnalysis && activePoiId ? (
            <OnePagerPreview
              ref={previewRef}
              data={previewData}
              pois={pois}
              infraObjects={infraObjects}
              layers={layers}
              connectionLines={connectionLines}
              mapFocus={mapFocus}
              selectedPoi={selectedPoi}
              readOnly={readOnly}
              onRoadmapChange={readOnly ? undefined : setRoadmap}
              onRecommendationChange={readOnly ? undefined : setRecommendationText}
            />
          ) : null}
        </>
      ) : (
        <OnePagerPreview
          ref={previewRef}
          data={previewData}
          pois={pois}
          infraObjects={infraObjects}
          layers={layers}
          connectionLines={connectionLines}
          mapFocus={mapFocus}
          selectedPoi={selectedPoi}
          readOnly={readOnly}
          onRoadmapChange={readOnly ? undefined : setRoadmap}
          onRecommendationChange={readOnly ? undefined : setRecommendationText}
        />
      )}
    </div>
  );
}
