import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAppStore } from '../store';
import { PoiParamsPanel } from '../components/PoiParamsPanel';
import {
  AnalysisEnvironmentTable,
  AnalysisSummaryHeader,
} from '../components/AnalysisEnvironmentTable';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const setCurrentProjectId = useAppStore((s) => s.setCurrentProjectId);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);

  useEffect(() => {
    if (id) setCurrentProjectId(id);
  }, [id, setCurrentProjectId]);

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.getProject(id!),
    enabled: !!id,
  });

  const { data: pois = [] } = useQuery({
    queryKey: ['pois', id],
    queryFn: () => api.getPois(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (pois.length > 0 && !selectedPoiId) setSelectedPoiId(pois[0].id);
  }, [pois, selectedPoiId]);

  const { data: analysisData } = useQuery({
    queryKey: ['analysis', id, selectedPoiId],
    queryFn: () => api.getPoiAnalysis(id!, selectedPoiId!),
    enabled: !!id && !!selectedPoiId,
    retry: false,
  });

  const analyzeMut = useMutation({
    mutationFn: (poiId: string) => api.analyzePoi(id!, poiId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analysis', id, selectedPoiId] });
    },
  });

  const constructionMut = useMutation({
    mutationFn: ({ subtype, force }: { subtype: string; force: boolean }) =>
      api.overrideAnalysis(id!, selectedPoiId!, subtype, { force_construction: force }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analysis', id, selectedPoiId] });
    },
  });

  const analysisRows = analysisData?.rows ?? [];

  return (
    <div>
      <div className="mb-4">
        <Link to="/projects" className="text-sm text-blue-600 hover:underline">← Проекты</Link>
      </div>
      <h1 className="text-2xl font-bold mb-2">{project?.name}</h1>
      <p className="mb-6" style={{ color: 'var(--text-muted)' }}>{project?.description}</p>

      <div className="flex gap-3 mb-6">
        <Link to="/rates" className="btn btn-secondary">Ставки</Link>
        <Link to="/map" className="btn btn-secondary">Карта</Link>
        <Link to="/matrix" className="btn btn-secondary">Матрица</Link>
        <Link to="/import" className="btn btn-secondary">Импорт</Link>
      </div>

      <div className="card mb-4">
        <h2 className="font-semibold mb-3">Точки интереса ({pois.length})</h2>
        {pois.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Нет точек интереса. Добавьте на карте.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Добыча, тыс. т/год</th>
                  <th>КП</th>
                  <th>Скважин</th>
                  <th>Флюид</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pois.map((poi) => (
                  <tr
                    key={poi.id}
                    className={selectedPoiId === poi.id ? 'bg-blue-50' : 'cursor-pointer'}
                    onClick={() => setSelectedPoiId(poi.id)}
                  >
                    <td>{poi.name}</td>
                    <td>{poi.planned_production_volume}</td>
                    <td>{poi.pads_count}</td>
                    <td>{Math.round(poi.wells_total)}</td>
                    <td>{poi.fluid_type === 'oil' ? 'Нефть' : 'Газ'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPoiId(poi.id);
                          analyzeMut.mutate(poi.id);
                        }}
                        disabled={analyzeMut.isPending}
                      >
                        Анализировать
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {id && pois.length > 0 && (
        <PoiParamsPanel
          projectId={id}
          poiId={selectedPoiId}
          onPoiChange={setSelectedPoiId}
          className="mb-4"
        />
      )}

      {analysisRows.length > 0 && (
        <div className="card">
          <AnalysisSummaryHeader
            totalCostMln={analysisData?.total_cost_mln}
            overallStatus={analysisData?.overall_status}
          />
          <AnalysisEnvironmentTable
            rows={analysisRows}
            onToggleConstruction={(subtype, force) =>
              constructionMut.mutate({ subtype, force })
            }
          />
        </div>
      )}
    </div>
  );
}
