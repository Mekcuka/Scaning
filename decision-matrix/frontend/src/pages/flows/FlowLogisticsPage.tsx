import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Network } from 'lucide-react';
import { api } from '../../lib/api';
import {
  SandLogisticsSubnetPanel,
  subnetTabLabel,
  subnetTabTitle,
} from '../../components/logistics/SandLogisticsSubnetPanel';
import { formatEntryDateRu } from '../../lib/infraEntryDate';
import {
  buildGlobalSandLogisticsWarningLines,
  loadActiveSubnetIndex,
  loadSandLogisticsFromSession,
  normalizeSandLogisticsResult,
  saveActiveSubnetIndex,
  saveSandLogisticsToSession,
  withInfraObjectNames,
} from '../../lib/sandLogisticsResult';
import { useFlowSchematicContext } from './flowSchematicContext';
import { useAppStore } from '../../store';

export function FlowLogisticsPage() {
  const { projectId } = useFlowSchematicContext();
  const pushToast = useAppStore((s) => s.pushToast);
  const queryClient = useQueryClient();

  const { data: result } = useQuery({
    queryKey: ['sand-logistics', projectId],
    queryFn: () => (projectId ? loadSandLogisticsFromSession(projectId) : null),
    enabled: !!projectId,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const { data: infraObjects = [] } = useQuery({
    queryKey: ['infra', projectId],
    queryFn: () => api.getInfraObjects(projectId!),
    enabled: !!projectId && !!result,
    staleTime: 60_000,
  });

  const resultWithNames = useMemo(
    () => (result ? withInfraObjectNames(result, infraObjects) : null),
    [result, infraObjects]
  );

  const [activeSubnetIndex, setActiveSubnetIndex] = useState(0);

  const subnets = result?.subnets ?? [];
  const maxSubnetIndex = Math.max(0, subnets.length - 1);

  useEffect(() => {
    if (!projectId || subnets.length === 0) {
      setActiveSubnetIndex(0);
      return;
    }
    setActiveSubnetIndex(loadActiveSubnetIndex(projectId, maxSubnetIndex));
  }, [projectId, subnets.length, maxSubnetIndex]);

  useEffect(() => {
    if (activeSubnetIndex > maxSubnetIndex) {
      setActiveSubnetIndex(maxSubnetIndex);
    }
  }, [activeSubnetIndex, maxSubnetIndex]);

  const activeSubnet = subnets[activeSubnetIndex] ?? null;

  const selectSubnet = (index: number) => {
    setActiveSubnetIndex(index);
    if (projectId) saveActiveSubnetIndex(projectId, index);
  };

  const analyzeMut = useMutation({
    mutationFn: () => api.analyzeSandLogistics(projectId!),
    onSuccess: (data) => {
      const normalized = normalizeSandLogisticsResult(data);
      queryClient.setQueryData(['sand-logistics', projectId], normalized);
      if (projectId) {
        saveSandLogisticsToSession(projectId, normalized);
        saveActiveSubnetIndex(projectId, 0);
      }
      setActiveSubnetIndex(0);
      pushToast('success', 'Логистика песка рассчитана');
    },
    onError: (err) => {
      pushToast('error', err instanceof Error ? err.message : 'Ошибка расчёта');
    },
  });

  const globalWarningLines = useMemo(
    () => (resultWithNames ? buildGlobalSandLogisticsWarningLines(resultWithNames) : []),
    [resultWithNames]
  );

  return (
    <section className="card p-4 flow-schematic-window space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flow-schematic-window-subtitle text-sm text-[var(--text-muted)]">
            Распределение объёмов песка по карьерам и потребителям внутри каждой связной подсети
            автодорог с карьером. Выберите подсеть для индивидуального анализа схемы, таблиц и
            диаграмм. Задайте объёмы на{' '}
            <Link to="/map" className="text-[var(--accent)] underline">
              карте
            </Link>
            , постройте сеть и нажмите расчёт.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary shrink-0"
          disabled={!projectId || analyzeMut.isPending}
          onClick={() => analyzeMut.mutate()}
        >
          {analyzeMut.isPending ? 'Расчёт…' : 'Рассчитать логистику песка'}
        </button>
      </div>

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
            Дата расчёта: {formatEntryDateRu(result.as_of)} · подсетей с карьерами:{' '}
            {result.subnet_count}
          </p>

          {subnets.length === 0 && (
            <p className="text-sm text-[var(--text-muted)] py-4 text-center">
              Нет связных подсетей автодорог с карьерами. Проверьте сеть на карте и предупреждения
              выше.
            </p>
          )}

          {subnets.length === 1 && activeSubnet && resultWithNames && (
            <SandLogisticsSubnetPanel subnet={activeSubnet} result={resultWithNames} />
          )}

          {subnets.length > 1 && (
            <>
              <nav className="parameters-subnav" aria-label="Подсети логистики песка">
                {subnets.map((subnet, index) => {
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

              {activeSubnet && resultWithNames && (
                <div id={`sand-subnet-panel-${activeSubnet.subnet_index}`}>
                  <SandLogisticsSubnetPanel subnet={activeSubnet} result={resultWithNames} />
                </div>
              )}
            </>
          )}
        </>
      )}

      {!result && !analyzeMut.isPending && (
        <p className="text-[var(--text-muted)] py-8 text-center text-sm">
          Нажмите «Рассчитать логистику песка», чтобы получить таблицы и диаграммы.
        </p>
      )}
    </section>
  );
}
