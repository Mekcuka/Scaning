import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAppStore } from '../store';
import { STATUS_LABELS, SUBTYPE_LABELS } from '../lib/specs';
import { PoiParamsPanel } from '../components/PoiParamsPanel';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const setCurrentProjectId = useAppStore((s) => s.setCurrentProjectId);
  const [analysis, setAnalysis] = useState<Awaited<ReturnType<typeof api.analyzePoi>> | null>(null);
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

  const analyzeMut = useMutation({
    mutationFn: (poiId: string) => api.analyzePoi(id!, poiId),
    onSuccess: setAnalysis,
  });

  useEffect(() => {
    if (pois.length > 0 && !selectedPoiId) setSelectedPoiId(pois[0].id);
  }, [pois, selectedPoiId]);

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
                          analyzeMut.mutate(poi.id);
                        }}
                        disabled={analyzeMut.isPending}
                      >
                        Анализ
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

      {analysis && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold">Анализ окружения</h2>
            <span className="text-lg font-bold">{analysis.total_cost_mln} млн ₽</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Подтип</th>
                  <th>Расстояние, км</th>
                  <th>Статус</th>
                  <th>Стоимость, млн ₽</th>
                </tr>
              </thead>
              <tbody>
                {analysis.analysis.map((row, i) => {
                  const r = row as Record<string, unknown>;
                  const subtype = String(r.subtype ?? '');
                  const status = String(r.status ?? '');
                  return (
                  <tr key={i}>
                    <td>{SUBTYPE_LABELS[subtype] || subtype}</td>
                    <td>{r.distance_km != null ? String(r.distance_km) : '—'}</td>
                    <td>
                      <span className={`badge ${
                        status === 'within_limit' || status === 'computed' ? 'badge-success' :
                        status === 'exceeds_limit' ? 'badge-danger' :
                        status === 'not_required' ? 'badge-muted' : 'badge-warning'
                      }`}>
                        {STATUS_LABELS[status] || status}
                      </span>
                    </td>
                    <td>{r.cost_mln != null ? String(r.cost_mln) : '—'}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
