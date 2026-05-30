import { Fragment, useEffect, useMemo, useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, Table, Zap } from 'lucide-react';
import { api, normalizePoiAnalysisResponse, type POI } from '../lib/api';
import { buildMatrixRowsByPois, resolvePoiColumnAnalysis } from '../lib/matrixData';
import { engineeringOptionsForKey, type EngineeringParamKey } from '../lib/poiParams';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import { AppSelect } from '../components/AppSelect';
import { useIsMobile } from '../hooks/useMediaQuery';

function initialMatrixViewMode(isMobile: boolean): 'table' | 'cards' {
  return isMobile ? 'cards' : 'table';
}

export function MatrixPage() {
  const { canWriteProject } = usePermissions();
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => initialMatrixViewMode(isMobile));
  const [viewModeTouched, setViewModeTouched] = useState(false);
  const [selectedCol, setSelectedCol] = useState(0);
  const [showOnlyExceeded, setShowOnlyExceeded] = useState(false);
  const projectId = useAppStore((s) => s.currentProjectId);
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);

  useEffect(() => {
    if (!viewModeTouched) {
      setViewMode(isMobile ? 'cards' : 'table');
    }
  }, [isMobile, viewModeTouched]);

  const { data: pois = [] } = useQuery({
    queryKey: ['pois', projectId],
    queryFn: () => api.getPois(projectId!),
    enabled: !!projectId,
  });

  const analysisQueries = useQueries({
    queries: pois.map((poi) => ({
      queryKey: ['analysis', projectId, poi.id],
      queryFn: async () => {
        const raw = await api.getPoiAnalysis(projectId!, poi.id);
        return normalizePoiAnalysisResponse(raw);
      },
      enabled: !!projectId,
      retry: false,
    })),
  });

  const analysisByPoiId = useMemo(() => {
    const map: Record<string, ReturnType<typeof resolvePoiColumnAnalysis>> = {};
    pois.forEach((poi, i) => {
      const live = analysisQueries[i]?.data;
      map[poi.id] = resolvePoiColumnAnalysis(poi, live);
    });
    return map;
  }, [pois, analysisQueries]);

  const displayedPois = useMemo(() => {
    if (!showOnlyExceeded) return pois;
    return pois.filter((poi) => {
      const rows = analysisByPoiId[poi.id]?.rows ?? [];
      return rows.some((r) => r.status === 'exceeds_limit');
    });
  }, [pois, showOnlyExceeded, analysisByPoiId]);

  const columnAnalysis = useMemo(
    () => displayedPois.map((poi) => analysisByPoiId[poi.id] ?? { rows: [], total_cost_mln: null }),
    [displayedPois, analysisByPoiId]
  );

  const { rows: matrixRows, columnNames, poisByColumn } = useMemo(
    () => buildMatrixRowsByPois(displayedPois, columnAnalysis),
    [displayedPois, columnAnalysis]
  );

  const safeSelectedCol = Math.min(selectedCol, Math.max(0, columnNames.length - 1));

  const sections = useMemo(() => {
    const seen = new Set<string>();
    return matrixRows.reduce<string[]>((acc, r) => {
      if (!seen.has(r.section)) {
        seen.add(r.section);
        acc.push(r.section);
      }
      return acc;
    }, []);
  }, [matrixRows]);

  const colCount = columnNames.length + 1;

  const analyzeMut = useMutation({
    mutationFn: () => api.analyzeAllPois(projectId!),
    onSuccess: async (batch) => {
      if (!projectId) return;
      for (const item of batch.results) {
        queryClient.setQueryData(
          ['analysis', projectId, item.poi_id],
          normalizePoiAnalysisResponse(item)
        );
      }
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

  const updateEngMut = useMutation({
    mutationFn: async ({
      poiId,
      key,
      value,
    }: {
      poiId: string;
      key: EngineeringParamKey;
      value: string;
    }) => {
      return api.updatePoi(projectId!, poiId, { [key]: value } as Partial<POI>);
    },
    onSuccess: (updated) => {
      if (!projectId) return;
      queryClient.setQueryData<POI[]>(['pois', projectId], (prev) =>
        (prev ?? []).map((p) => (p.id === updated.id ? updated : p))
      );
      queryClient.removeQueries({ queryKey: ['analysis', projectId, updated.id] });
      pushToast('success', 'Изменения сохранены');
    },
    onError: (err) => {
      pushToast(
        'error',
        err instanceof Error ? err.message : 'Не удалось сохранить параметр'
      );
    },
  });

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-title-block">
          <h1 className="page-title">Матрица решений</h1>
          <p className="page-subtitle">
            Сравнение анализа окружения по всем точкам интереса проекта
          </p>
        </div>
        <div className="page-toolbar-actions">
          {projectId && pois.length > 0 && canWriteProject && (
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
              {analyzeMut.isPending
                ? 'Расчёт…'
                : pois.length > 1
                  ? `Анализ (${pois.length})`
                  : 'Анализ'}
            </button>
          )}
          <button
            type="button"
            className={`btn ${showOnlyExceeded ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setShowOnlyExceeded((v) => !v);
              setSelectedCol(0);
            }}
          >
            Только с превышениями
          </button>
          <button
            type="button"
            className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setViewModeTouched(true);
              setViewMode('table');
            }}
          >
            <Table size={16} /> Таблица
          </button>
          <button
            type="button"
            className={`btn ${viewMode === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setViewModeTouched(true);
              setViewMode('cards');
            }}
          >
            <LayoutGrid size={16} /> Карточки
          </button>
        </div>
      </div>

      <div>
          {pois.length === 0 ? (
            <div className="card text-sm" style={{ color: 'var(--text-muted)' }}>
              В проекте нет точек интереса. Добавьте POI на карте.
            </div>
          ) : viewMode === 'table' ? (
            <div className="card p-0 table-wrap matrix-table-wrap">
              <table className="data-table matrix-table">
                <thead>
                  <tr>
                    <th>Параметр</th>
                    {columnNames.map((name, i) => (
                      <th
                        key={poisByColumn[i]?.id ?? name + i}
                        className={`cursor-pointer ${safeSelectedCol === i ? 'bg-blue-50' : ''}`}
                        onClick={() => setSelectedCol(i)}
                        title={poisByColumn[i]?.name}
                      >
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedPois.length === 0 ? (
                    <tr>
                      <td colSpan={colCount} className="text-center py-6" style={{ color: 'var(--text-muted)' }}>
                        Нет POI с превышениями лимитов
                      </td>
                    </tr>
                  ) : (
                    sections.map((section) => (
                      <Fragment key={section}>
                        <tr>
                          <td colSpan={colCount} className="font-semibold bg-gray-50 text-xs uppercase tracking-wide">
                            {section}
                          </td>
                        </tr>
                        {matrixRows
                          .filter((r) => r.section === section)
                          .map((row) => (
                            <tr key={`${row.section}-${row.label}`}>
                              <td>{row.label}</td>
                              {row.cells.map((cell, i) => {
                                const poi = poisByColumn[i];
                                const engKey = row.engineeringKey;

                                return (
                                  <td
                                    key={poisByColumn[i]?.id ?? i}
                                    className={`${row.total ? 'font-bold' : ''} ${
                                      cell.status === 'exceeds_limit' ? 'text-red-600' : ''
                                    } ${safeSelectedCol === i ? 'bg-blue-50/50' : ''} ${
                                      engKey && poi ? 'matrix-eng-cell' : ''
                                    }`}
                                    onClick={engKey && poi ? (e) => e.stopPropagation() : undefined}
                                  >
                                    {engKey && poi ? (
                                      <AppSelect
                                        variant="compact"
                                        className="matrix-eng-select"
                                        ariaLabel={`${row.label}: ${poi.name}`}
                                        value={String(poi[engKey] ?? '')}
                                        readOnly={!canWriteProject}
                                        disabled={updateEngMut.isPending || !canWriteProject}
                                        onChange={(value) => {
                                          if (value === poi[engKey]) return;
                                          updateEngMut.mutate({
                                            poiId: poi.id,
                                            key: engKey,
                                            value,
                                          });
                                        }}
                                        options={engineeringOptionsForKey(engKey)}
                                      />
                                    ) : cell.badge ? (
                                      <span className="badge badge-secondary">{cell.text}</span>
                                    ) : cell.subtext ? (
                                      <div className="matrix-cell-stacked">
                                        <div className="matrix-cell-cost">{cell.text}</div>
                                        <div className="matrix-cell-detail">{cell.subtext}</div>
                                      </div>
                                    ) : (
                                      cell.text
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                      </Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {displayedPois.length === 0 ? (
                <div className="card text-sm" style={{ color: 'var(--text-muted)' }}>
                  Нет POI с превышениями лимитов
                </div>
              ) : (
                columnNames.map((name, i) => {
                  const col = columnAnalysis[i];
                  const hasAnalysis = (col?.rows.length ?? 0) > 0;
                  return (
                    <div
                      key={poisByColumn[i]?.id ?? name + i}
                      className={`card cursor-pointer ${safeSelectedCol === i ? 'ring-2 ring-blue-500' : ''}`}
                      onClick={() => setSelectedCol(i)}
                    >
                      <h3 className="font-semibold mb-3">{name}</h3>
                      <div className="text-2xl font-bold text-blue-600 mb-2">
                        {col?.total_cost_mln != null ? `${col.total_cost_mln} млн ₽` : '—'}
                      </div>
                      <div className="text-sm space-y-1" style={{ color: 'var(--text-muted)' }}>
                        {!hasAnalysis && (
                          <div className="text-xs">
                            Нажмите «Анализировать окружение» для расчёта
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
      </div>
    </div>
  );
}
