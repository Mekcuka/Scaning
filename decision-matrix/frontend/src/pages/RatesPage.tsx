import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Save } from 'lucide-react';
import { Button, Card, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { defaultProjectsRatesApi, type DistanceDefaults } from '../lib/api';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import { useProjectPois } from '../hooks/useProjectData';
import { AppSelect } from '../components/AppSelect';
import {
  CAPEX_RATE_GROUPS,
  DISTANCE_PARAMETER_GROUPS,
  OPEX_PARAMETER_GROUPS,
  REVENUE_PARAMETER_GROUPS,
  buildDefaultDistanceDefaults,
  buildDefaultEconomicParams,
  buildDefaultRates,
  effectiveCostRate,
} from '../lib/specs';
import type { DistanceParameterGroup, ParameterGroup } from '../lib/parameterCatalog';
import { DeferredNumberInput } from '../components/DeferredNumberInput';
import { AppDataTable } from '../components/AppDataTable';
import { ratesKeyValueExportColumns } from '../lib/tableExcelExportData';

type RateTableRow = {
  id: string;
  label: string;
  defaultValue: number;
};

export const RATES_PROJECT_SCOPE = '__project__';

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
  const dataSource: RateTableRow[] = group.rows.map((row) => ({
    id: row.id,
    label: row.label,
    defaultValue: row.defaultValue,
  }));

  const exportRows = dataSource.map((row) => ({
    label: row.label,
    value: getValue(row.id, row.defaultValue),
  }));

  const columns = useMemo<ColumnsType<RateTableRow>>(
    () => [
      {
        title: 'Параметр',
        dataIndex: 'label',
        key: 'label',
        className: 'rates-table__label',
        onCell: () => ({ scope: 'row' as const }),
      },
      {
        title: group.unitLabel,
        key: 'value',
        className: 'rates-table__value',
        render: (_, row) => (
          <DeferredNumberInput
            className="rates-input"
            min={0}
            groupDigits
            readOnly={readOnly}
            value={getValue(row.id, row.defaultValue)}
            onCommit={(v) => onCommit(row.id, v as number)}
          />
        ),
      },
    ],
    [group.unitLabel, getValue, onCommit, readOnly],
  );

  return (
    <Card className="card--flush rates-group-card" styles={{ body: { padding: 0 } }}>
      <div className="rates-group-head">
        <h3>{group.label}</h3>
      </div>
      <AppDataTable
        className="rates-table"
        rowKey="id"
        showHeader={false}
        columns={columns}
        dataSource={dataSource}
        tableExtra={<span className="rates-group-unit">{group.unitLabel}</span>}
        excelExport={{
          filename: `stavki-${group.id}.xlsx`,
          sheetName: group.label,
          columns: ratesKeyValueExportColumns(),
          rows: exportRows,
        }}
      />
    </Card>
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
  const dataSource: RateTableRow[] = group.rows.map((row) => ({
    id: row.id,
    label: row.label,
    defaultValue: row.defaultValue,
  }));

  const exportRows = group.rows.map((row) => ({
    label: row.label,
    value: values[row.distanceKey] ?? row.defaultValue,
  }));

  const columns = useMemo<ColumnsType<RateTableRow>>(
    () => [
      {
        title: 'Параметр',
        dataIndex: 'label',
        key: 'label',
        className: 'rates-table__label',
        onCell: () => ({ scope: 'row' as const }),
      },
      {
        title: group.unitLabel,
        key: 'value',
        className: 'rates-table__value',
        render: (_, row) => {
          const distanceKey = group.rows.find((r) => r.id === row.id)?.distanceKey;
          if (!distanceKey) return null;
          return (
            <DeferredNumberInput
              className="rates-input"
              min={0}
              groupDigits
              readOnly={readOnly}
              value={values[distanceKey] ?? row.defaultValue}
              onCommit={(v) => onCommit(distanceKey, v as number)}
            />
          );
        },
      },
    ],
    [group.rows, group.unitLabel, onCommit, readOnly, values],
  );

  return (
    <Card className="card--flush rates-group-card" styles={{ body: { padding: 0 } }}>
      <div className="rates-group-head">
        <h3>{group.label}</h3>
      </div>
      <AppDataTable
        className="rates-table"
        rowKey="id"
        showHeader={false}
        columns={columns}
        dataSource={dataSource}
        tableExtra={<span className="rates-group-unit">{group.unitLabel}</span>}
        excelExport={{
          filename: `stavki-rasstoyaniya-${group.id}.xlsx`,
          sheetName: group.label,
          columns: ratesKeyValueExportColumns(),
          rows: exportRows,
        }}
      />
    </Card>
  );
}

export function RatesPage() {
  const { canWriteProject } = usePermissions();
  const projectId = useAppStore((s) => s.currentProjectId);
  const qc = useQueryClient();
  const [scope, setScope] = useState(RATES_PROJECT_SCOPE);
  const [rates, setRates] = useState<Record<string, number>>(buildDefaultRates());
  const [econParams, setEconParams] = useState<Record<string, number>>(buildDefaultEconomicParams());
  const [distanceDefaults, setDistanceDefaults] = useState<DistanceDefaults>(buildDefaultDistanceDefaults());
  const pushToast = useAppStore((s) => s.pushToast);
  const backfillRef = useRef(false);

  const isProjectScope = scope === RATES_PROJECT_SCOPE;
  const activePoiId = isProjectScope ? '' : scope;

  const { data: pois = [], isLoading: poisLoading } = useProjectPois(projectId);

  const scopeOptions = useMemo(
    () => [
      { value: RATES_PROJECT_SCOPE, label: 'Проект (по умолчанию)' },
      ...pois.map((p) => ({ value: p.id, label: p.name })),
    ],
    [pois],
  );

  const { data: projectRatesData, isLoading: projectRatesLoading } = useQuery({
    queryKey: ['rates', projectId, 'project'],
    queryFn: () => defaultProjectsRatesApi.getRates(projectId!),
    enabled: !!projectId && isProjectScope,
  });

  const { data: projectEconData, isLoading: projectEconLoading } = useQuery({
    queryKey: ['economic-params', projectId, 'project'],
    queryFn: () => defaultProjectsRatesApi.getEconomicParams(projectId!),
    enabled: !!projectId && isProjectScope,
  });

  const { data: projectDistanceData, isLoading: projectDistanceLoading } = useQuery({
    queryKey: ['distanceDefaults', projectId, 'project'],
    queryFn: () => defaultProjectsRatesApi.getDistanceDefaults(projectId!),
    enabled: !!projectId && isProjectScope,
  });

  const { data: poiRatesData, isLoading: poiRatesLoading } = useQuery({
    queryKey: ['rates', projectId, activePoiId],
    queryFn: () => defaultProjectsRatesApi.getPoiRates(projectId!, activePoiId),
    enabled: !!projectId && !!activePoiId,
  });

  const { data: poiEconData, isLoading: poiEconLoading } = useQuery({
    queryKey: ['economic-params', projectId, activePoiId],
    queryFn: () => defaultProjectsRatesApi.getPoiEconomicParams(projectId!, activePoiId),
    enabled: !!projectId && !!activePoiId,
  });

  const { data: poiDistanceData, isLoading: poiDistanceLoading } = useQuery({
    queryKey: ['distanceDefaults', projectId, activePoiId],
    queryFn: () => defaultProjectsRatesApi.getPoiDistanceSettings(projectId!, activePoiId),
    enabled: !!projectId && !!activePoiId,
  });

  useEffect(() => {
    backfillRef.current = false;
    setScope(RATES_PROJECT_SCOPE);
  }, [projectId]);

  useEffect(() => {
    if (isProjectScope) {
      if (projectRatesData?.rates) setRates(projectRatesData.rates);
      if (projectEconData?.params) setEconParams(projectEconData.params);
      if (projectDistanceData) setDistanceDefaults(projectDistanceData);
    }
  }, [isProjectScope, projectRatesData, projectEconData, projectDistanceData]);

  useEffect(() => {
    if (!isProjectScope) {
      if (poiRatesData?.rates) setRates(poiRatesData.rates);
      if (poiEconData?.params) setEconParams(poiEconData.params);
      if (poiDistanceData?.settings) setDistanceDefaults(poiDistanceData.settings);
    }
  }, [isProjectScope, poiRatesData, poiEconData, poiDistanceData, activePoiId]);

  useEffect(() => {
    if (!projectId || !projectRatesData?.rates || backfillRef.current || !canWriteProject || !isProjectScope) {
      return;
    }
    const defaults = buildDefaultRates();
    const patch: Record<string, number> = {};
    for (const [key, defaultVal] of Object.entries(defaults)) {
      if ((projectRatesData.rates[key] ?? 0) === 0 && defaultVal !== 0) {
        patch[key] = defaultVal;
      }
    }
    if (Object.keys(patch).length === 0) {
      backfillRef.current = true;
      return;
    }
    backfillRef.current = true;
    const normalized = { ...projectRatesData.rates, ...patch };
    setRates(normalized);
    void defaultProjectsRatesApi.updateRates(projectId, normalized).then(() => {
      void qc.invalidateQueries({ queryKey: ['rates', projectId] });
      void qc.invalidateQueries({ queryKey: ['economic-flow-schematic', projectId] });
    });
  }, [projectId, projectRatesData, qc, canWriteProject, isProjectScope]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!projectId) return;
      if (isProjectScope) {
        await defaultProjectsRatesApi.updateRates(projectId, rates);
        await defaultProjectsRatesApi.updateEconomicParams(projectId, econParams);
        await defaultProjectsRatesApi.updateDistanceDefaults(projectId, distanceDefaults);
        return;
      }
      await defaultProjectsRatesApi.updatePoiRates(projectId, activePoiId, rates);
      await defaultProjectsRatesApi.updatePoiEconomicParams(projectId, activePoiId, econParams);
      await defaultProjectsRatesApi.updatePoiDistanceSettings(projectId, activePoiId, distanceDefaults);
    },
    onSuccess: () => {
      if (!projectId) return;
      const scopeKey = isProjectScope ? 'project' : activePoiId;
      void qc.invalidateQueries({ queryKey: ['rates', projectId, scopeKey] });
      void qc.invalidateQueries({ queryKey: ['economic-params', projectId, scopeKey] });
      void qc.invalidateQueries({ queryKey: ['distanceDefaults', projectId, scopeKey] });
      if (!isProjectScope) {
        void qc.invalidateQueries({ queryKey: ['economic-flow-schematic', projectId, activePoiId] });
        void qc.invalidateQueries({ queryKey: ['poi-analysis', projectId, activePoiId] });
      } else {
        void qc.invalidateQueries({ queryKey: ['economic-flow-schematic', projectId] });
      }
      pushToast('success', 'Параметры сохранены');
    },
    onError: (err: Error) => {
      pushToast('error', err.message || 'Не удалось сохранить параметры');
    },
  });

  const resetMut = useMutation({
    mutationFn: async () => {
      if (!projectId) return;
      if (isProjectScope) {
        setRates(buildDefaultRates());
        setEconParams(buildDefaultEconomicParams());
        setDistanceDefaults(buildDefaultDistanceDefaults());
        return;
      }
      await defaultProjectsRatesApi.updatePoiRates(projectId, activePoiId, null);
      await defaultProjectsRatesApi.updatePoiEconomicParams(projectId, activePoiId, null);
      await defaultProjectsRatesApi.updatePoiDistanceSettings(projectId, activePoiId, { clear: true });
      const [ratesRes, econRes, distRes] = await Promise.all([
        defaultProjectsRatesApi.getPoiRates(projectId, activePoiId),
        defaultProjectsRatesApi.getPoiEconomicParams(projectId, activePoiId),
        defaultProjectsRatesApi.getPoiDistanceSettings(projectId, activePoiId),
      ]);
      setRates(ratesRes.rates);
      setEconParams(econRes.params);
      setDistanceDefaults(distRes.settings);
    },
    onSuccess: () => {
      if (!projectId) return;
      const scopeKey = isProjectScope ? 'project' : activePoiId;
      void qc.invalidateQueries({ queryKey: ['rates', projectId, scopeKey] });
      void qc.invalidateQueries({ queryKey: ['economic-params', projectId, scopeKey] });
      void qc.invalidateQueries({ queryKey: ['distanceDefaults', projectId, scopeKey] });
      if (!isProjectScope) {
        void qc.invalidateQueries({ queryKey: ['economic-flow-schematic', projectId, activePoiId] });
      }
      pushToast('success', isProjectScope ? 'Значения сброшены' : 'Переопределения POI сброшены');
    },
    onError: (err: Error) => {
      pushToast('error', err.message || 'Не удалось сбросить параметры');
    },
  });

  const setDistanceField = (key: keyof DistanceDefaults, value: number) => {
    setDistanceDefaults((prev) => ({ ...prev, [key]: value }));
  };

  if (!projectId) {
    return (
      <div className="rates-page">
        <Card size="small" className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Выберите проект в шапке приложения.
        </Card>
      </div>
    );
  }

  const busy = isProjectScope
    ? projectRatesLoading || projectEconLoading || projectDistanceLoading
    : poiRatesLoading || poiEconLoading || poiDistanceLoading || poisLoading;

  const resetLabel = isProjectScope ? 'Сброс' : 'Наследовать проект';

  return (
    <div className="rates-page">
      <header className="parameters-section-head rates-page-top">
        <div className="rates-page-top__main">
          <div className="rates-poi-select">
            <AppSelect
              ariaLabel="Объект"
              value={scope}
              onChange={setScope}
              options={scopeOptions}
              disabled={poisLoading}
              fullWidth
            />
          </div>
        </div>
        <div className="rates-actions">
          {!canWriteProject ? null : (
            <Space>
              <Button
                size="small"
                icon={<RotateCcw size={14} />}
                onClick={() => resetMut.mutate()}
                loading={resetMut.isPending}
                disabled={busy}
              >
                {resetMut.isPending ? 'Сброс…' : resetLabel}
              </Button>
              <Button
                type="primary"
                size="small"
                icon={<Save size={14} />}
                onClick={() => saveMut.mutate()}
                loading={saveMut.isPending}
                disabled={busy}
              >
                {saveMut.isPending ? 'Сохранение…' : 'Сохранить'}
              </Button>
            </Space>
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

        <section className="rates-category" aria-labelledby="rates-revenue-heading">
          <h2 id="rates-revenue-heading" className="rates-section-title">
            Выручка
          </h2>
          <div className="rates-groups-grid">
            {REVENUE_PARAMETER_GROUPS.map((group) => (
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
