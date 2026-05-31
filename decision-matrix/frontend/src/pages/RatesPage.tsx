import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Save } from 'lucide-react';
import { api, type DistanceDefaults } from '../lib/api';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import {
  CAPEX_RATE_GROUPS,
  DISTANCE_PARAMETER_GROUPS,
  OPEX_PARAMETER_GROUPS,
  buildDefaultDistanceDefaults,
  buildDefaultEconomicParams,
  buildDefaultRates,
  effectiveCostRate,
} from '../lib/specs';
import type { DistanceParameterGroup, ParameterGroup } from '../lib/parameterCatalog';
import { DeferredNumberInput } from '../components/DeferredNumberInput';
import { TableExcelExportButton } from '../components/TableExcelExportButton';
import { ratesKeyValueExportColumns } from '../lib/tableExcelExportData';

function RatesGroupTable({
  group,
  readOnly,
  getValue,
  onCommit,
}: {
  group: ParameterGroup;
  readOnly: boolean;
  getValue: (id: string, fallback: number) => number;
  onCommit: (id: string, value: number) => void;
}) {
  const exportRows = group.rows.map((row) => ({
    label: row.label,
    value: getValue(row.id, row.defaultValue),
  }));

  return (
    <section className="card card--flush rates-group-card">
      <div className="rates-group-head">
        <h3>{group.label}</h3>
        <div className="rates-group-head__actions">
          <span className="rates-group-unit">{group.unitLabel}</span>
          <TableExcelExportButton
            filename={`stavki-${group.id}.xlsx`}
            sheetName={group.label}
            columns={ratesKeyValueExportColumns()}
            rows={exportRows}
          />
        </div>
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
                    readOnly={readOnly}
                    value={getValue(row.id, row.defaultValue)}
                    onCommit={(v) => onCommit(row.id, v as number)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DistanceGroupTable({
  group,
  readOnly,
  values,
  onCommit,
}: {
  group: DistanceParameterGroup;
  readOnly: boolean;
  values: DistanceDefaults;
  onCommit: (key: keyof DistanceDefaults, value: number) => void;
}) {
  const exportRows = group.rows.map((row) => ({
    label: row.label,
    value: values[row.distanceKey] ?? row.defaultValue,
  }));

  return (
    <section className="card card--flush rates-group-card">
      <div className="rates-group-head">
        <h3>{group.label}</h3>
        <div className="rates-group-head__actions">
          <span className="rates-group-unit">{group.unitLabel}</span>
          <TableExcelExportButton
            filename={`stavki-rasstoyaniya-${group.id}.xlsx`}
            sheetName={group.label}
            columns={ratesKeyValueExportColumns()}
            rows={exportRows}
          />
        </div>
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
                    readOnly={readOnly}
                    value={values[row.distanceKey] ?? row.defaultValue}
                    onCommit={(v) => onCommit(row.distanceKey, v as number)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function RatesPage() {
  const { canWriteProject } = usePermissions();
  const projectId = useAppStore((s) => s.currentProjectId);
  const qc = useQueryClient();
  const [rates, setRates] = useState<Record<string, number>>(buildDefaultRates());
  const [econParams, setEconParams] = useState<Record<string, number>>(buildDefaultEconomicParams());
  const [distanceDefaults, setDistanceDefaults] = useState<DistanceDefaults>(buildDefaultDistanceDefaults());
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

  const { data: distanceData, isLoading: distanceLoading } = useQuery({
    queryKey: ['distanceDefaults', projectId],
    queryFn: () => api.getDistanceDefaults(projectId!),
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
    if (distanceData) setDistanceDefaults(distanceData);
  }, [distanceData]);

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
      await api.updateDistanceDefaults(projectId!, distanceDefaults);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rates', projectId] });
      qc.invalidateQueries({ queryKey: ['economic-params', projectId] });
      qc.invalidateQueries({ queryKey: ['distanceDefaults', projectId] });
      qc.invalidateQueries({ queryKey: ['economic-flow-schematic', projectId] });
      pushToast('success', 'Параметры сохранены');
    },
    onError: (err: Error) => {
      pushToast('error', err.message || 'Не удалось сохранить параметры');
    },
  });

  const handleReset = () => {
    setRates(buildDefaultRates());
    setEconParams(buildDefaultEconomicParams());
    setDistanceDefaults(buildDefaultDistanceDefaults());
  };

  const setDistanceField = (key: keyof DistanceDefaults, value: number) => {
    setDistanceDefaults((prev) => ({ ...prev, [key]: value }));
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

  const busy = isLoading || econLoading || distanceLoading;

  return (
    <div className="rates-page">
      <header className="parameters-section-head rates-page-top">
        <p className="parameters-section-head__subtitle">
          Расстояния · CAPEX · OPEX — значения по умолчанию для анализа и экономики потока
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
                disabled={saveMut.isPending || busy}
              >
                <Save size={14} className="inline mr-1" />
                {saveMut.isPending ? 'Сохранение…' : 'Сохранить'}
              </button>
            </>
          )}
        </div>
      </header>

      <div className="rates-categories">
        <section className="rates-category" aria-labelledby="rates-distance-heading">
          <h2 id="rates-distance-heading" className="rates-section-title">
            Расстояние
          </h2>
          <div className="rates-groups-grid">
            {DISTANCE_PARAMETER_GROUPS.map((group) => (
              <DistanceGroupTable
                key={group.id}
                group={group}
                readOnly={!canWriteProject}
                values={distanceDefaults}
                onCommit={setDistanceField}
              />
            ))}
          </div>
        </section>

        <section className="rates-category" aria-labelledby="rates-capex-heading">
          <h2 id="rates-capex-heading" className="rates-section-title">
            CAPEX
          </h2>
          <div className="rates-groups-grid">
            {CAPEX_RATE_GROUPS.map((group) => (
              <RatesGroupTable
                key={group.id}
                group={group}
                readOnly={!canWriteProject}
                getValue={(id, fallback) => effectiveCostRate(rates, id, fallback)}
                onCommit={(id, value) => setRates({ ...rates, [id]: value })}
              />
            ))}
          </div>
        </section>

        <section className="rates-category" aria-labelledby="rates-opex-heading">
          <h2 id="rates-opex-heading" className="rates-section-title">
            OPEX
          </h2>
          <div className="rates-groups-grid">
            {OPEX_PARAMETER_GROUPS.map((group) => (
              <RatesGroupTable
                key={group.id}
                group={group}
                readOnly={!canWriteProject}
                getValue={(id, fallback) => econParams[id] ?? fallback}
                onCommit={(id, value) => setEconParams({ ...econParams, [id]: value })}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
