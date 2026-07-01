import { useMemo, useState } from 'react';
import { useSyncAssistantUiContext } from '../../lib/assistant/assistantContext';
import { Outlet } from 'react-router-dom';
import { Alert, Card, Spin } from 'antd';
import { ProjectLink } from '../../components/ProjectLink';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActiveProject } from '../../hooks/useActiveProject';
import { useProjectPois } from '../../hooks/useProjectData';
import { queryKeys } from '../../lib/queryKeys';
import { Coins, Workflow } from 'lucide-react';
import { AppSelect } from '../../components/AppSelect';
import { defaultFlowSchematicApi, defaultProjectsPoiWriteApi, type POI } from '../../lib/api';
import type { FlowSchematicDto } from '../../lib/flowSchematic';
import { WARNING_LABELS } from '../../lib/flowSchematic';
import { useAppStore } from '../../store';
import { useProjectPathBuilder } from '../../hooks/useProjectPath';
import { FlowSchematicProvider } from './flowSchematicContext';
import { SubnavTabs } from '../../components/layout/SubnavTabs';

const TABS = [
  { suffix: '/flows/technology', label: 'Технологический поток', icon: Workflow },
  { suffix: '/flows/economic', label: 'Экономический поток', icon: Coins },
] as const;

export function FlowSchematicLayout() {
  const { projectId } = useActiveProject();
  const buildPath = useProjectPathBuilder();
  const pushToast = useAppStore((s) => s.pushToast);
  const queryClient = useQueryClient();
  const [selectedPoiId, setSelectedPoiId] = useState('');

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
          <Card className="text-center">
            <span className="text-[var(--text-muted)]">
              Выберите проект в шапке, чтобы построить схему потоков.
            </span>
          </Card>
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
              <Alert
                className="mb-4"
                type="warning"
                showIcon
                message={
                  <>
                    {WARNING_LABELS.network_not_built}{' '}
                    <ProjectLink to="/map" className="font-medium underline">
                      Перейти на карту
                    </ProjectLink>
                  </>
                }
              />
            )}

            <SubnavTabs
              ariaLabel="Разделы схемы потоков"
              tabs={TABS.map(({ suffix, label, icon: Icon }) => ({
                key: suffix,
                to: buildPath(suffix),
                label: (
                  <span className="inline-flex items-center gap-2">
                    <Icon size={16} aria-hidden />
                    {label}
                  </span>
                ),
              }))}
            />

            <div className="parameters-layout__body">
              {showPoiFlows ? (
                <Outlet />
              ) : poisLoading ? (
                <Card className="text-center">
                  <Spin />
                  <span className="ml-2 text-[var(--text-muted)]">Загрузка…</span>
                </Card>
              ) : (
                <Card className="text-center space-y-3">
                  <p className="text-[var(--text-muted)]">
                    В проекте нет точек интереса. Добавьте POI на{' '}
                    <ProjectLink to="/map" className="underline">
                      карте
                    </ProjectLink>
                    , чтобы открыть технологический и экономический потоки.
                  </p>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </FlowSchematicProvider>
  );
}
