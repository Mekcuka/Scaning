import { useParams, Link } from 'react-router-dom';
import { projectPath } from '../lib/projectRoutes';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Map, Table2, Coins, Upload, Zap, MapPin, Settings2, BarChart3 } from 'lucide-react';
import {
  defaultMapAnalysisApi,
  defaultProjectsDataApi,
  normalizePoiAnalysisResponse,
  type POI,
} from '../lib/api';
import { analyzeAllPoisAndWait } from '../lib/runApiJob';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import { useSyncAssistantUiContext } from '../lib/assistant/assistantContext';
import { usePageHeader } from '../components/layout/pageHeaderContext';
import { PoiParamsPanel } from '../components/PoiParamsPanel';
import {
  AnalysisEnvironmentTable,
  AnalysisSummaryHeader,
} from '../components/AnalysisEnvironmentTable';
import {
  fluidTypeLabel,
  plannedProductionLabel,
} from '../lib/poiParams';

type DetailTab = 'params' | 'analysis';

function formatWellsTotal(wells: number | null | undefined): string {
  if (wells == null || !Number.isFinite(wells) || wells <= 0) return '—';
  return String(Math.trunc(wells));
}

function formatProductionShort(poi: POI): string {
  const label = plannedProductionLabel(poi);
  if (label) return label;
  if (poi.planned_production_volume > 0) return String(poi.planned_production_volume);
  return '—';
}

function poiSummaryLine(poi: POI): string {
  const parts = [
    formatProductionShort(poi),
    `${poi.pads_count} КП`,
    `${formatWellsTotal(poi.wells_total)} скв.`,
  ];
  return parts.join(' · ');
}

export function ProjectDetailPage() {
  const { canWriteProject, can } = usePermissions();
  const { id } = useParams<{ id: string }>();
  const projectHref = (suffix: string) => projectPath(id ?? '', suffix);
  const queryClient = useQueryClient();
  const setCurrentProjectId = useAppStore((s) => s.setCurrentProjectId);
  const pushToast = useAppStore((s) => s.pushToast);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('params');

  useEffect(() => {
    if (id) setCurrentProjectId(id);
  }, [id, setCurrentProjectId]);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => defaultProjectsDataApi.getProject(id!),
    enabled: !!id,
  });

  const { data: pois = [], isLoading: poisLoading } = useQuery({
    queryKey: ['pois', id],
    queryFn: () => defaultProjectsDataApi.getPois(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (pois.length > 0 && !selectedPoiId) setSelectedPoiId(pois[0].id);
  }, [pois, selectedPoiId]);

  const effectivePoiId = selectedPoiId ?? pois[0]?.id ?? null;
  const selectedPoi = pois.find((p) => p.id === effectivePoiId) ?? null;
  useSyncAssistantUiContext({
    selectedPoiId: selectedPoi?.id ?? null,
    selectedPoiName: selectedPoi?.name ?? null,
  });

  const {
    data: analysisData,
    isLoading: analysisLoading,
    isFetching: analysisFetching,
  } = useQuery({
    queryKey: ['analysis', id, effectivePoiId],
    queryFn: () => defaultMapAnalysisApi.getPoiAnalysis(id!, effectivePoiId!),
    enabled: !!id && !!effectivePoiId,
    retry: false,
  });

  const analyzeMut = useMutation({
    mutationFn: () => analyzeAllPoisAndWait(id!),
    onSuccess: (batch) => {
      for (const item of batch.results) {
        queryClient.setQueryData(
          ['analysis', id, item.poi_id],
          normalizePoiAnalysisResponse(item)
        );
      }
      queryClient.invalidateQueries({ queryKey: ['analysis', id] });
      setDetailTab('analysis');
      pushToast(
        'success',
        batch.analyzed_count === 1
          ? 'Анализ окружения выполнен для 1 точки'
          : `Анализ окружения выполнен для ${batch.analyzed_count} точек`
      );
    },
    onError: (err) => {
      pushToast(
        'error',
        err instanceof Error ? err.message : 'Не удалось выполнить анализ окружения'
      );
    },
  });

  const analysisRows = analysisData?.rows ?? [];
  const pageLoading = projectLoading || poisLoading;
  const analyzeLabel =
    pois.length > 1 ? `Анализ (${pois.length})` : 'Анализ';
  const analysisPending = analysisLoading || analysisFetching;

  usePageHeader(
    {
      title: project?.name ?? 'Проект',
      subtitle: project?.description?.trim() || null,
    },
    [project?.description, project?.name],
  );

  if (pageLoading) {
    return (
      <div className="project-detail-page">
        <div className="project-detail-page-loading">Загрузка проекта…</div>
      </div>
    );
  }

  return (
    <div className="project-detail-page">
      <nav className="project-detail-breadcrumb" aria-label="Навигация">
        <Link to="/projects">Проекты</Link>
        <span className="project-detail-breadcrumb__sep" aria-hidden>
          /
        </span>
        <span className="project-detail-breadcrumb__current">{project?.name ?? '…'}</span>
      </nav>

      <div className="page-toolbar page-toolbar--actions-only">
        <div className="page-toolbar-actions">
          {pois.length > 0 && canWriteProject && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => analyzeMut.mutate()}
              disabled={analyzeMut.isPending}
              title={
                pois.length > 1
                  ? `Пересчитать анализ для всех ${pois.length} точек`
                  : 'Пересчитать анализ окружения'
              }
            >
              <Zap size={16} className="inline mr-1" />
              {analyzeMut.isPending ? 'Расчёт…' : analyzeLabel}
            </button>
          )}
        </div>
      </div>

      <nav className="project-detail-quick-nav" aria-label="Разделы проекта">
        <Link to={projectHref('/map')} className="project-detail-quick-nav__link">
          <Map size={15} aria-hidden />
          Карта
        </Link>
        <Link to={projectHref('/matrix')} className="project-detail-quick-nav__link">
          <Table2 size={15} aria-hidden />
          Матрица
        </Link>
        <Link to={projectHref('/parameters/rates')} className="project-detail-quick-nav__link">
          <Coins size={15} aria-hidden />
          Ставки
        </Link>
        {can('write_infra') && (
          <Link to={projectHref('/data/import')} className="project-detail-quick-nav__link">
            <Upload size={15} aria-hidden />
            Импорт
          </Link>
        )}
      </nav>

      <div className="project-detail-grid">
        <aside className="card card--flush project-detail-sidebar" aria-label="Точки интереса">
          <div className="card-header">
            <h2>Точки интереса</h2>
            <span className="project-detail-sidebar__count">{pois.length}</span>
          </div>
          {pois.length === 0 ? (
            <div className="project-detail-empty">
              <p>Нет точек интереса в этом проекте.</p>
              <Link to={projectHref('/map')} className="btn btn-secondary btn-sm">
                Добавить на карте
              </Link>
            </div>
          ) : (
            <ul className="project-detail-poi-nav" role="listbox" aria-label="Список точек интереса">
              {pois.map((poi) => {
                const selected = effectivePoiId === poi.id;
                return (
                  <li key={poi.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={
                        selected
                          ? 'project-detail-poi-nav__item project-detail-poi-nav__item--selected'
                          : 'project-detail-poi-nav__item'
                      }
                      onClick={() => {
                        setSelectedPoiId(poi.id);
                        setDetailTab('params');
                      }}
                    >
                      <span className="project-detail-poi-nav__main">
                        <span className="project-detail-poi-nav__name">{poi.name}</span>
                        <span className="project-detail-poi-nav__meta">{poiSummaryLine(poi)}</span>
                      </span>
                      <span
                        className={`badge project-detail-fluid-badge--${poi.fluid_type === 'gas' ? 'gas' : 'oil'}`}
                      >
                        {fluidTypeLabel(poi.fluid_type)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <main className="project-detail-main">
          {pois.length === 0 || !selectedPoi ? (
            <div className="card project-detail-empty project-detail-empty--panel">
              <p>
                {pois.length === 0
                  ? 'Создайте точку интереса на карте, чтобы настроить параметры и запустить анализ.'
                  : 'Выберите точку интереса в списке слева.'}
              </p>
            </div>
          ) : (
            <div className="card card--flush project-detail-panel object-detail-panel">
              <header className="project-detail-panel__header">
                <div className="project-detail-panel__header-text">
                  <h2 className="project-detail-panel__title">{selectedPoi.name}</h2>
                  <div className="project-detail-panel__chips">
                    <span
                      className={`badge project-detail-fluid-badge--${selectedPoi.fluid_type === 'gas' ? 'gas' : 'oil'}`}
                    >
                      {fluidTypeLabel(selectedPoi.fluid_type)}
                    </span>
                    <span className="project-detail-panel__chip">{formatProductionShort(selectedPoi)}</span>
                    <span className="project-detail-panel__chip">{selectedPoi.pads_count} КП</span>
                    <span className="project-detail-panel__chip">
                      {formatWellsTotal(selectedPoi.wells_total)} скв.
                    </span>
                  </div>
                </div>
                <Link to={projectHref('/map')} className="btn btn-secondary btn-sm project-detail-panel__map-link">
                  <MapPin size={14} aria-hidden />
                  На карте
                </Link>
              </header>

              <div className="object-detail-panel__tabs" role="tablist" aria-label="Разделы точки">
                <button
                  type="button"
                  role="tab"
                  id="project-detail-tab-params"
                  aria-selected={detailTab === 'params'}
                  aria-controls="project-detail-panel-params"
                  className={
                    detailTab === 'params'
                      ? 'object-detail-panel__tab object-detail-panel__tab--labeled object-detail-panel__tab--active'
                      : 'object-detail-panel__tab object-detail-panel__tab--labeled'
                  }
                  onClick={() => setDetailTab('params')}
                >
                  <Settings2 size={14} aria-hidden />
                  <span className="object-detail-panel__tab-label">Параметры</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  id="project-detail-tab-analysis"
                  aria-selected={detailTab === 'analysis'}
                  aria-controls="project-detail-panel-analysis"
                  className={
                    detailTab === 'analysis'
                      ? 'object-detail-panel__tab object-detail-panel__tab--labeled object-detail-panel__tab--active'
                      : 'object-detail-panel__tab object-detail-panel__tab--labeled'
                  }
                  onClick={() => setDetailTab('analysis')}
                >
                  <BarChart3 size={14} aria-hidden />
                  <span className="object-detail-panel__tab-label">Анализ окружения</span>
                </button>
              </div>

              <div className="object-detail-panel__body project-detail-panel__body">
                {detailTab === 'params' && id && (
                  <div
                    role="tabpanel"
                    id="project-detail-panel-params"
                    aria-labelledby="project-detail-tab-params"
                  >
                    <PoiParamsPanel
                      projectId={id}
                      poiId={effectivePoiId}
                      onPoiChange={setSelectedPoiId}
                      flat
                      embedded
                      hidePoiSelector
                      sections={['basic', 'engineering']}
                      footer={<Link to={projectHref('/map')}>Пороги и нормы → на карте</Link>}
                    />
                  </div>
                )}

                {detailTab === 'analysis' && (
                  <div
                    role="tabpanel"
                    id="project-detail-panel-analysis"
                    aria-labelledby="project-detail-tab-analysis"
                    className="project-detail-analysis"
                  >
                    {analysisPending ? (
                      <div className="project-detail-analysis-loading">Загрузка анализа…</div>
                    ) : analysisRows.length > 0 ? (
                      <>
                        <AnalysisSummaryHeader
                          totalCostMln={analysisData?.total_cost_mln}
                          overallStatus={analysisData?.overall_status}
                        />
                        <AnalysisEnvironmentTable
                          rows={analysisRows}
                          readOnly={!canWriteProject}
                        />
                      </>
                    ) : (
                      <div className="project-detail-empty project-detail-empty--compact">
                        <p>Анализ окружения не выполнен для этой точки.</p>
                        {canWriteProject && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => analyzeMut.mutate()}
                            disabled={analyzeMut.isPending}
                          >
                            <Zap size={14} className="inline mr-1" />
                            {analyzeMut.isPending ? 'Расчёт…' : 'Анализировать окружение'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
