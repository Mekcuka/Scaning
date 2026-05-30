import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Save } from 'lucide-react';
import { api } from '../lib/api';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import {
  COST_RATE_GROUPS,
  ECONOMIC_PARAM_GROUPS,
  buildDefaultEconomicParams,
  buildDefaultRates,
  effectiveCostRate,
} from '../lib/specs';
import { ProjectDistanceDefaultsForm } from '../components/ProjectDistanceDefaultsForm';
import { DeferredNumberInput } from '../components/DeferredNumberInput';

export function RatesPage() {
  const { canWriteProject } = usePermissions();
  const projectId = useAppStore((s) => s.currentProjectId);
  const qc = useQueryClient();
  const [rates, setRates] = useState<Record<string, number>>(buildDefaultRates());
  const [econParams, setEconParams] = useState<Record<string, number>>(buildDefaultEconomicParams());
  const pushToast = useAppStore((s) => s.pushToast);
  const backfillRef = useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ['rates', projectId],
    queryFn: () => api.getRates(projectId!),
    enabled: !!projectId,
  });

  const { data: econData, isLoading: econLoading } = useQuery({
    queryKey: ['economic-params', projectId],
    queryFn: () => api.getEconomicParams(projectId!),
    enabled: !!projectId,
  });

  useEffect(() => {
    backfillRef.current = false;
  }, [projectId]);

  useEffect(() => {
    if (!data?.rates) return;
    setRates(data.rates);
  }, [data]);

  useEffect(() => {
    if (!projectId || !data?.rates || backfillRef.current || !canWriteProject) return;
    const defaults = buildDefaultRates();
    const patch: Record<string, number> = {};
    for (const [key, defaultVal] of Object.entries(defaults)) {
      if ((data.rates[key] ?? 0) === 0 && defaultVal !== 0) {
        patch[key] = defaultVal;
      }
    }
    if (Object.keys(patch).length === 0) {
      backfillRef.current = true;
      return;
    }
    backfillRef.current = true;
    const normalized = { ...data.rates, ...patch };
    setRates(normalized);
    void api.updateRates(projectId, normalized).then(() => {
      void qc.invalidateQueries({ queryKey: ['rates', projectId] });
      void qc.invalidateQueries({ queryKey: ['economic-flow-schematic', projectId] });
    });
  }, [projectId, data, qc, canWriteProject]);

  useEffect(() => {
    if (econData?.params) setEconParams(econData.params);
  }, [econData]);

  const saveMut = useMutation({
    mutationFn: async () => {
      await api.updateRates(projectId!, rates);
      await api.updateEconomicParams(projectId!, econParams);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rates', projectId] });
      qc.invalidateQueries({ queryKey: ['economic-params', projectId] });
      qc.invalidateQueries({ queryKey: ['economic-flow-schematic', projectId] });
      pushToast('success', 'Ставки сохранены');
    },
    onError: (err: Error) => {
      pushToast('error', err.message || 'Не удалось сохранить ставки');
    },
  });

  const handleReset = () => {
    setRates(buildDefaultRates());
    setEconParams(buildDefaultEconomicParams());
    if (projectId) {
      qc.invalidateQueries({ queryKey: ['distanceDefaults', projectId] });
    }
  };

  if (!projectId) {
    return (
      <div className="rates-page">
        <div className="card text-sm" style={{ color: 'var(--text-muted)' }}>
          Выберите проект в шапке приложения.
        </div>
      </div>
    );
  }

  return (
    <div className="rates-page">
      <header className="parameters-section-head rates-page-top">
        <p className="parameters-section-head__subtitle">
          CAPEX · экономика потока (OPEX и цены) · расстояния POI
        </p>
        <div className="rates-actions">
          {!canWriteProject ? null : (
            <>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleReset}>
            <RotateCcw size={14} className="inline mr-1" />
            Сброс
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || isLoading || econLoading}
          >
            <Save size={14} className="inline mr-1" />
            {saveMut.isPending ? 'Сохранение…' : 'Сохранить ставки'}
          </button>
            </>
          )}
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
                              groupDigits
                              readOnly={!canWriteProject}
                              value={effectiveCostRate(rates, row.id, row.defaultValue)}
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

            <div className="rates-economic-section col-span-full">
              <h2 className="rates-section-title mb-3">Экономика потока</h2>
              <div className="rates-groups-grid">
                {ECONOMIC_PARAM_GROUPS.map((group) => (
                  <section key={group.id} className="card card--flush rates-group-card">
                    <div className="rates-group-head">
                      <h3>{group.label}</h3>
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
                                  groupDigits
                                  readOnly={!canWriteProject}
                                  value={econParams[row.id] ?? row.defaultValue}
                                  onCommit={(v) =>
                                    setEconParams({ ...econParams, [row.id]: v as number })
                                  }
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
          </div>
        </div>

        <aside className="rates-aside">
          <ProjectDistanceDefaultsForm projectId={projectId} compact readOnly={!canWriteProject} />
        </aside>
      </div>
    </div>
  );
}
