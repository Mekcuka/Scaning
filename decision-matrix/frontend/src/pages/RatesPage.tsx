import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Save } from 'lucide-react';
import { api } from '../lib/api';
import { useAppStore } from '../store';
import { COST_RATE_GROUPS, buildDefaultRates } from '../lib/specs';
import { ProjectDistanceDefaultsForm } from '../components/ProjectDistanceDefaultsForm';
import { DeferredNumberInput } from '../components/DeferredNumberInput';

export function RatesPage() {
  const projectId = useAppStore((s) => s.currentProjectId);
  const qc = useQueryClient();
  const [rates, setRates] = useState<Record<string, number>>(buildDefaultRates());
  const pushToast = useAppStore((s) => s.pushToast);

  const { data, isLoading } = useQuery({
    queryKey: ['rates', projectId],
    queryFn: () => api.getRates(projectId!),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (data?.rates) setRates(data.rates);
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () => api.updateRates(projectId!, rates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rates', projectId] });
      pushToast('success', 'Ставки сохранены');
    },
    onError: (err: Error) => {
      pushToast('error', err.message || 'Не удалось сохранить ставки');
    },
  });

  const handleReset = () => {
    setRates(buildDefaultRates());
    if (projectId) {
      qc.invalidateQueries({ queryKey: ['distanceDefaults', projectId] });
    }
  };

  if (!projectId) {
    return (
      <div className="rates-page">
        <header className="page-header">
          <h1>Ставки стоимости</h1>
          <p className="subtitle">16 показателей · параметры расстояний проекта</p>
        </header>
        <div className="card text-sm" style={{ color: 'var(--text-muted)' }}>
          Выберите проект в шапке приложения.
        </div>
      </div>
    );
  }

  return (
    <div className="rates-page">
      <header className="page-header rates-page-top">
        <div>
          <h1>Ставки стоимости</h1>
          <p className="subtitle">16 показателей · расстояния и пороги для POI</p>
        </div>
        <div className="rates-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleReset}>
            <RotateCcw size={14} className="inline mr-1" />
            Сброс
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || isLoading}
          >
            <Save size={14} className="inline mr-1" />
            {saveMut.isPending ? 'Сохранение…' : 'Сохранить ставки'}
          </button>
        </div>
      </header>

      <div className="rates-layout">
        <div className="rates-main">
          <div className="rates-groups-grid">
            {COST_RATE_GROUPS.map((group) => (
              <section key={group.id} className="card card--flush rates-group-card">
                <div className="rates-group-head">
                  <h2>{group.label}</h2>
                  <span className="rates-group-unit">{group.unitLabel}</span>
                </div>
                <div className="table-wrap">
                  <table className="rates-table">
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={row.id}>
                          <th scope="row">{row.label}</th>
                          <td>
                            <DeferredNumberInput
                              className="rates-input"
                              min={0}
                              value={rates[row.id] ?? row.defaultValue}
                              onCommit={(v) => setRates({ ...rates, [row.id]: v as number })}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        </div>

        <aside className="rates-aside">
          <ProjectDistanceDefaultsForm projectId={projectId} compact />
        </aside>
      </div>
    </div>
  );
}
