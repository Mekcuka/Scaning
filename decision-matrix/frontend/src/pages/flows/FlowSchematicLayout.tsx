import { useMemo, useState } from 'react';
import { useSyncAssistantUiContext } from '../../lib/assistant/assistantContext';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ProjectLink } from '../../components/ProjectLink';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActiveProject } from '../../hooks/useActiveProject';
import { useProjectPois } from '../../hooks/useProjectData';
import { queryKeys } from '../../lib/queryKeys';
import { Coins, Truck, Workflow } from 'lucide-react';
import { AppSelect } from '../../components/AppSelect';
import { defaultFlowSchematicApi, defaultProjectsPoiWriteApi, type POI } from '../../lib/api';
import type { FlowSchematicDto } from '../../lib/flowSchematic';
import { WARNING_LABELS } from '../../lib/flowSchematic';
import { useAppStore } from '../../store';
import { stripProjectPrefix } from '../../lib/projectRoutes';
import { useProjectPathBuilder } from '../../hooks/useProjectPath';
import { FlowSchematicProvider } from './flowSchematicContext';

const TABS = [
  { suffix: '/flows/technology', label: 'Технологический поток', icon: Workflow },
  { suffix: '/flows/economic', label: 'Экономический поток', icon: Coins },
  { suffix: '/flows/logistics', label: 'Логистика', icon: Truck },
] as const;

export function FlowSchematicLayout() {
  const { projectId } = useActiveProject();
  const buildPath = useProjectPathBuilder();
  const pushToast = useAppStore((s) => s.pushToast);
  const queryClient = useQueryClient();
  const [selectedPoiId, setSelectedPoiId] = useState('');
  const location = useLocation();
  const logicalPath = stripProjectPrefix(location.pathname);
  const isLogisticsRoute =
    logicalPath === '/flows/logistics' ||
    logicalPath.startsWith('/flows/logistics/');

  const { data: pois = [], isLoading: poisLoading } = useProjectPois(projectId);

  const activePoiId = selectedPoiId || pois[0]?.id || '';
  const activePoi = useMemo(
    () => pois.find((p) => p.id === activePoiId) ?? null,
    [pois, activePoiId],
  );

  useSyncAssistantUiContext({
    selectedPoiId: activePoi?.id ?? null,
    selectedPoiName: activePoi?.name ?? null,
  });

  const schematicQuery = useQuery({
    queryKey: ['flow-schematic', projectId, activePoiId],
    queryFn: () => defaultFlowSchematicApi.getFlowSchematic(projectId!, activePoiId),
    enabled: !!projectId && !!activePoiId,
  });

  const schematic = schematicQuery.data;
  const isError = schematicQuery.isError;

  const economicQuery = useQuery({
    queryKey: ['economic-flow-schematic', projectId, activePoiId],
    queryFn: () => defaultFlowSchematicApi.getEconomicFlowSchematic(projectId!, activePoiId),
    enabled: !!projectId && !!activePoiId && !!schematic && !isError,
  });

  const persistSchematicMut = useMutation({
    mutationFn: (dto: FlowSchematicDto) =>
      defaultFlowSchematicApi.saveFlowSchematic(projectId!, activePoiId, {
        nodes: dto.nodes,
        edges: dto.edges,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['flow-schematic', projectId, activePoiId], data);
    },
    onError: (err) => {
      pushToast('error', err instanceof Error ? err.message : 'Не удалось сохранить схему');
    },
  });

  const saveMut = useMutation({
    mutationFn: (dto: FlowSchematicDto) =>
      defaultFlowSchematicApi.saveFlowSchematic(projectId!, activePoiId, {
        nodes: dto.nodes,
        edges: dto.edges,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['flow-schematic', projectId, activePoiId] });
      void queryClient.invalidateQueries({
        queryKey: ['economic-flow-schematic', projectId, activePoiId],
      });
      pushToast('success', 'Схема потоков сохранена');
    },
    onError: (err) => {
      pushToast('error', err instanceof Error ? err.message : 'Не удалось сохранить схему');
    },
  });

  const poiProductionMut = useMutation({
    mutationFn: (volume: number) =>
      defaultProjectsPoiWriteApi.updatePoi(projectId!, activePoiId, {
        planned_production_volume: volume,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData<POI[]>(queryKeys.pois(projectId!), (old) =>
        old?.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)) ?? []
      );
    },
    onError: (err) => {
      pushToast('error', err instanceof Error ? err.message : 'Не удалось обновить дебит точки');
    },
  });

  const resetMut = useMutation({
    mutationFn: () => defaultFlowSchematicApi.resetFlowSchematic(projectId!, activePoiId),
    onSuccess: (data) => {
      queryClient.setQueryData(['flow-schematic', projectId, activePoiId], data);
      void queryClient.invalidateQueries({ queryKey: ['flow-schematic', projectId, activePoiId] });
      void queryClient.invalidateQueries({
        queryKey: ['economic-flow-schematic', projectId, activePoiId],
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.pois(projectId!) });
      pushToast('success', data.source === 'custom' ? 'Схема обновлена' : 'Восстановлена расчётная схема');
    },
    onError: (err) => {
      pushToast('error', err instanceof Error ? err.message : 'Не удалось сбросить схему');
    },
  });

  const schematicEditorKey = schematic
    ? `${activePoiId}:${schematic.source}:${schematic.nodes.map((n) => n.id).join('|')}:${schematic.edges.length}`
    : activePoiId;

  const needsNetwork = schematic?.warnings.includes('network_not_built') ?? false;

  const showPoiFlows = !!projectId && !!activePoiId;

  const contextValue = {
    projectId: projectId ?? null,
    pois,
    poisLoading,
    activePoiId,
    setSelectedPoiId,
    schematicQuery,
    economicQuery,
    schematicEditorKey,
    needsNetwork,
    saveMut,
    persistSchematicMut,
    poiProductionMut,
    resetMut,
  };

  return (
    <FlowSchematicProvider value={contextValue}>
      <div className="flow-schematic-page parameters-layout">
        {!projectId && (
          <div className="card p-8 text-center text-[var(--text-muted)]">
            Выберите проект в шапке, чтобы построить схему потоков.
          </div>
        )}

        {projectId && (
          <>
            {projectId && pois.length > 0 && (
              <div className="flow-schematic-page-select mb-4 flex items-center gap-2 w-full sm:w-auto">
                <span className="text-sm text-[var(--text-muted)] shrink-0">Точка интереса</span>
                <AppSelect
                  value={activePoiId}
                  onChange={setSelectedPoiId}
                  options={pois.map((p) => ({ value: p.id, label: p.name || p.id }))}
                  className="min-w-0 flex-1"
                />
              </div>
            )}

            {needsNetwork && showPoiFlows && (
              <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
                {WARNING_LABELS.network_not_built}{' '}
                <ProjectLink to="/map" className="font-medium text-[var(--accent)] underline">
                  Перейти на карту
                </ProjectLink>
              </div>
            )}

            <nav className="parameters-subnav" aria-label="Разделы схемы потоков">
              {TABS.map(({ suffix, label, icon: Icon }) => (
                <NavLink
                  key={suffix}
                  to={buildPath(suffix)}
                  className={({ isActive }) =>
                    `parameters-subnav__tab${isActive ? ' parameters-subnav__tab--active' : ''}`
                  }
                >
                  <Icon size={16} aria-hidden />
                  {label}
                </NavLink>
              ))}
            </nav>

            {isLogisticsRoute || showPoiFlows ? (
              <Outlet />
            ) : poisLoading ? (
              <div className="card p-8 text-center text-[var(--text-muted)]">Загрузка…</div>
            ) : (
              <div className="card p-8 text-center text-[var(--text-muted)] space-y-3">
                <p>
                  В проекте нет точек интереса. Добавьте POI на{' '}
                  <ProjectLink to="/map" className="text-[var(--accent)] underline">
                    карте
                  </ProjectLink>
                  , чтобы открыть технологический и экономический потоки.
                </p>
                <p>
                  <ProjectLink to="/flows/logistics" className="btn btn-primary btn-sm">
                    Открыть логистику песка
                  </ProjectLink>
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </FlowSchematicProvider>
  );
}
