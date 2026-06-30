import { ProjectLink } from '../../components/ProjectLink';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { Network } from 'lucide-react';
import { Button, Card, Input } from 'antd';
import { analyzeSandLogisticsAndWait } from '../../lib/runApiJob';
import {
  SandLogisticsSubnetPanel,
  subnetTabLabel,
  subnetTabTitle,
} from '../../components/logistics/SandLogisticsSubnetPanel';
import { formatEntryDateRu, todayIsoLocal } from '../../lib/infraEntryDate';
import { computeHorizonBoundsFromInfra } from '../../lib/infraSandVolumes';
import {
  buildGlobalSandLogisticsWarningLines,
  hasLegacySandLogisticsSession,
  horizonYearRange,
  loadActiveSubnetIndex,
  loadSandLogisticsHorizonTo,
  loadSandLogisticsViewAsOf,
  normalizeSandLogisticsResult,
  prefetchSchematicSubnetsAtView,
  resolveSubnetsAtView,
  resolveSubnetForSchematicAtView,
  saveActiveSubnetIndex,
  saveSandLogisticsHorizonTo,
  saveSandLogisticsViewAsOf,
  clearLegacySandLogisticsSession,
  withInfraObjectNames,
} from '../../lib/sandLogisticsResult';
import {
  useProjectSandLogistics,
  writeSandLogisticsCache,
} from '../../hooks/useProjectSandLogistics';
import { useProjectInfraObjects } from '../../hooks/useProjectData';
import { useFlowSchematicContext } from './flowSchematicContext';
import { useAppStore } from '../../store';

function formatCalculatedAtRu(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function FlowLogisticsPage() {
  const { projectId } = useFlowSchematicContext();
  const pushToast = useAppStore((s) => s.pushToast);
  const queryClient = useQueryClient();

  const { data: result, isLoading: resultLoading } = useProjectSandLogistics(projectId);

  const { data: infraObjects = [] } = useProjectInfraObjects(projectId, {
    staleTime: 60_000,
  });

  const autoBounds = useMemo(
    () => (infraObjects.length > 0 ? computeHorizonBoundsFromInfra(infraObjects) : null),
    [infraObjects],
  );

  const resultWithNames = useMemo(
    () => (result ? withInfraObjectNames(result, infraObjects) : null),
    [result, infraObjects],
  );

  const [activeSubnetIndex, setActiveSubnetIndex] = useState(0);
  const [horizonTo, setHorizonTo] = useState(() =>
    projectId ? loadSandLogisticsHorizonTo(projectId) ?? todayIsoLocal() : todayIsoLocal(),
  );
  const [viewAsOf, setViewAsOf] = useState(() =>
    projectId ? loadSandLogisticsViewAsOf(projectId, todayIsoLocal()) : todayIsoLocal(),
  );

  useEffect(() => {
    if (autoBounds) {
      setHorizonTo((prev) => {
        const stored = projectId ? loadSandLogisticsHorizonTo(projectId) : null;
        return stored ?? prev ?? autoBounds.horizonTo;
      });
    }
  }, [autoBounds, projectId]);

  useEffect(() => {
    if (result?.horizon_to) {
      setHorizonTo(result.horizon_to);
      if (projectId) saveSandLogisticsHorizonTo(projectId, result.horizon_to);
    }
    if (result?.as_of) {
      setViewAsOf((prev) => {
        const stored = projectId ? loadSandLogisticsViewAsOf(projectId, result.as_of) : result.as_of;
        return stored ?? prev;
      });
    }
  }, [result?.horizon_to, result?.as_of, projectId]);

  const horizonFrom = autoBounds?.horizonFrom ?? result?.horizon_from ?? todayIsoLocal();
  const analyzeHorizonMismatch =
    result != null && result.horizon_to !== horizonTo;
  const viewAsOfMismatch = result != null && result.as_of !== viewAsOf;

  const timelineSubnets = useMemo(
    () => (resultWithNames ? resolveSubnetsAtView(resultWithNames, viewAsOf) : []),
    [resultWithNames, viewAsOf],
  );

  const canonicalSubnets = resultWithNames?.subnets ?? [];

  const legacySessionOnly =
    !result && !resultLoading && projectId != null && hasLegacySandLogisticsSession(projectId);

  const maxSubnetIndex = Math.max(0, canonicalSubnets.length - 1);

  useEffect(() => {
    if (!projectId || canonicalSubnets.length === 0) {
      setActiveSubnetIndex(0);
      return;
    }
    setActiveSubnetIndex(loadActiveSubnetIndex(projectId, maxSubnetIndex));
  }, [projectId, canonicalSubnets.length, maxSubnetIndex]);

  useEffect(() => {
    if (activeSubnetIndex > maxSubnetIndex) {
      setActiveSubnetIndex(maxSubnetIndex);
    }
  }, [activeSubnetIndex, maxSubnetIndex]);

  const activeCanonicalSubnet = canonicalSubnets[activeSubnetIndex] ?? null;
  const activeSubnet =
    activeCanonicalSubnet && resultWithNames
      ? resolveSubnetForSchematicAtView(resultWithNames, activeCanonicalSubnet, viewAsOf)
      : null;

  const selectSubnet = (index: number) => {
    setActiveSubnetIndex(index);
    if (projectId) saveActiveSubnetIndex(projectId, index);
  };

  const [isViewTransitionPending, startViewTransition] = useTransition();

  const handleViewAsOfChange = useCallback(
    (next: string) => {
      startViewTransition(() => {
        setViewAsOf(next);
        if (projectId) saveSandLogisticsViewAsOf(projectId, next);
      });
    },
    [projectId],
  );

  useEffect(() => {
    if (!resultWithNames?.timeline.length) return;
    prefetchSchematicSubnetsAtView(resultWithNames);
  }, [resultWithNames]);

  const viewYears = useMemo(
    () => (result ? horizonYearRange(result) : []),
    [result],
  );

  const analyzeMut = useMutation({
    mutationFn: () =>
      analyzeSandLogisticsAndWait(projectId!, {
        horizonFrom,
        horizonTo,
        asOf: viewAsOf,
      }),
    onSuccess: (data) => {
      const normalized = normalizeSandLogisticsResult(data);
      if (projectId) {
        void queryClient.invalidateQueries({ queryKey: ['activeJob', projectId] });
        writeSandLogisticsCache(queryClient, projectId, normalized);
        saveSandLogisticsHorizonTo(projectId, horizonTo);
        saveSandLogisticsViewAsOf(projectId, viewAsOf);
        saveActiveSubnetIndex(projectId, 0);
        clearLegacySandLogisticsSession(projectId);
      }
      setActiveSubnetIndex(0);
      pushToast('success', 'Логистика песка рассчитана и сохранена в проект');
    },
    onError: (err) => {
      pushToast('error', err instanceof Error ? err.message : 'Ошибка расчёта');
    },
  });

  const globalWarningLines = useMemo(
    () =>
      resultWithNames ? buildGlobalSandLogisticsWarningLines(resultWithNames, viewAsOf) : [],
    [resultWithNames, viewAsOf],
  );

  const calculatedAtLabel = formatCalculatedAtRu(result?.calculated_at);
  const showViewSlice = viewYears.length > 1;

  return (
    <Card className="flow-schematic-window" classNames={{ body: 'p-4 space-y-6' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flow-schematic-window-subtitle text-sm text-[var(--text-muted)]">
            Распределение объёмов песка по карьерам и потребителям внутри каждой связной подсети
            автодорог с карьером. Расчёт выполняется по годам внутри горизонта; срез на схеме можно
            менять без пересчёта. Задайте объёмы на{' '}
            <ProjectLink to="/map" className="text-[var(--accent)] underline">
              карте
            </ProjectLink>
            , постройте сеть и нажмите расчёт.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3 shrink-0">
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            Горизонт с
            <Input
              type="date"
              size="small"
              value={horizonFrom}
              readOnly
              title="Минимальная дата ввода объектов и автодорог"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            Горизонт по
            <Input
              type="date"
              size="small"
              value={horizonTo}
              onChange={(e) => {
                const next = e.target.value || autoBounds?.horizonTo || todayIsoLocal();
                setHorizonTo(next);
                if (projectId) saveSandLogisticsHorizonTo(projectId, next);
              }}
            />
          </label>
          {autoBounds && (
            <Button
              size="small"
              className="shrink-0"
              onClick={() => {
                setHorizonTo(autoBounds.horizonTo);
                if (projectId) saveSandLogisticsHorizonTo(projectId, autoBounds.horizonTo);
              }}
            >
              Подставить автоматически
            </Button>
          )}
          <Button
            type="primary"
            className="shrink-0"
            disabled={!projectId}
            loading={analyzeMut.isPending}
            onClick={() => analyzeMut.mutate()}
          >
            {analyzeMut.isPending ? 'Расчёт…' : 'Рассчитать логистику песка'}
          </Button>
        </div>
      </div>

      {legacySessionOnly && (
        <p className="text-xs text-amber-600 dark:text-amber-400" role="status">
          В браузере остался старый результат (до сохранения в проект). Нажмите «Рассчитать», чтобы
          записать его в базу и открыть на других устройствах.
        </p>
      )}

      {analyzeHorizonMismatch && (
        <p className="text-xs text-amber-600 dark:text-amber-400" role="status">
          Выбран конец горизонта {formatEntryDateRu(horizonTo)}, а сохранён расчёт до{' '}
          {formatEntryDateRu(result!.horizon_to)}. Нажмите «Рассчитать», чтобы обновить.
        </p>
      )}

      {viewAsOfMismatch && !analyzeHorizonMismatch && (
        <p className="text-xs text-amber-600 dark:text-amber-400" role="status">
          Сохранён срез на {formatEntryDateRu(result!.as_of)}; для схемы выбран{' '}
          {formatEntryDateRu(viewAsOf)} (без пересчёта).
        </p>
      )}

      {result && globalWarningLines.length > 0 && (
        <div
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
          role="status"
        >
          <p className="font-medium mb-1">Общие предупреждения</p>
          <ul className="list-disc pl-5 space-y-1 text-[var(--text-muted)]">
            {globalWarningLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {result && (
        <>
          <p className="text-xs text-[var(--text-muted)]">
            Горизонт {formatEntryDateRu(result.horizon_from)} — {formatEntryDateRu(result.horizon_to)}
            {showViewSlice ? ` · срез на ${formatEntryDateRu(viewAsOf)}` : ''}
            {' · '}подсетей с карьерами: {result.subnet_count}
            {timelineSubnets.length !== result.subnet_count
              ? ` · на срезе активных: ${timelineSubnets.length}`
              : ''}
            {calculatedAtLabel ? ` · рассчитано: ${calculatedAtLabel}` : ''}
          </p>

          {canonicalSubnets.length === 0 && (
            <p className="text-sm text-[var(--text-muted)] py-4 text-center">
              Нет связных подсетей автодорог с карьерами. Проверьте сеть на карте и предупреждения
              выше.
            </p>
          )}

          {canonicalSubnets.length === 1 && activeSubnet && activeCanonicalSubnet && resultWithNames && (
            <SandLogisticsSubnetPanel
              canonicalSubnet={activeCanonicalSubnet}
              sliceSubnet={activeSubnet}
              result={resultWithNames}
              viewAsOf={viewAsOf}
              onViewAsOfChange={handleViewAsOfChange}
            />
          )}

          {canonicalSubnets.length > 1 && (
            <>
              <nav className="parameters-subnav" aria-label="Подсети логистики песка">
                {canonicalSubnets.map((subnet, index) => {
                  const active = index === activeSubnetIndex;
                  const hasWarnings = subnet.warnings.length > 0;
                  return (
                    <button
                      key={subnet.subnet_index}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      aria-controls={`sand-subnet-panel-${subnet.subnet_index}`}
                      title={subnetTabTitle(subnet)}
                      className={`parameters-subnav__tab${active ? ' parameters-subnav__tab--active' : ''}`}
                      onClick={() => selectSubnet(index)}
                    >
                      <Network size={16} aria-hidden />
                      {subnetTabLabel(subnet)}
                      {hasWarnings && (
                        <span
                          className="inline-flex h-2 w-2 rounded-full bg-amber-500 shrink-0"
                          aria-label="есть предупреждения"
                        />
                      )}
                    </button>
                  );
                })}
              </nav>

              {activeSubnet && activeCanonicalSubnet && resultWithNames && (
                <div
                  id={`sand-subnet-panel-${activeCanonicalSubnet.subnet_index}`}
                  aria-busy={isViewTransitionPending}
                >
                  <SandLogisticsSubnetPanel
                    canonicalSubnet={activeCanonicalSubnet}
                    sliceSubnet={activeSubnet}
                    result={resultWithNames}
                    viewAsOf={viewAsOf}
                    onViewAsOfChange={handleViewAsOfChange}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

      {!result && !analyzeMut.isPending && resultLoading && (
        <p className="text-[var(--text-muted)] py-8 text-center text-sm">Загрузка сохранённого расчёта…</p>
      )}

      {!result && !analyzeMut.isPending && !resultLoading && (
        <p className="text-[var(--text-muted)] py-8 text-center text-sm">
          Нажмите «Рассчитать логистику песка», чтобы получить таблицы и диаграммы.
        </p>
      )}
    </Card>
  );
}
