import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GitBranch, Coins, Workflow } from 'lucide-react';
import { AppSelect } from '../../components/AppSelect';
import { api, type POI } from '../../lib/api';
import type { FlowSchematicDto } from '../../lib/flowSchematic';
import { WARNING_LABELS } from '../../lib/flowSchematic';
import { useAppStore } from '../../store';
import { FlowSchematicProvider } from './flowSchematicContext';

const TABS = [
  { to: '/flows/technology', label: 'Технологический поток', icon: Workflow },
  { to: '/flows/economic', label: 'Экономический поток', icon: Coins },
] as const;

export function FlowSchematicLayout() {
  const projectId = useAppStore((s) => s.currentProjectId);
  const pushToast = useAppStore((s) => s.pushToast);
  const queryClient = useQueryClient();
  const [selectedPoiId, setSelectedPoiId] = useState('');

  const { data: pois = [], isLoading: poisLoading } = useQuery({
    queryKey: ['pois', projectId],
    queryFn: () => api.getPois(projectId!),
    enabled: !!projectId,
  });

  const activePoiId = selectedPoiId || pois[0]?.id || '';

  const schematicQuery = useQuery({
    queryKey: ['flow-schematic', projectId, activePoiId],
    queryFn: () => api.getFlowSchematic(projectId!, activePoiId),
    enabled: !!projectId && !!activePoiId,
  });

  const schematic = schematicQuery.data;
  const isError = schematicQuery.isError;

  const economicQuery = useQuery({
    queryKey: ['economic-flow-schematic', projectId, activePoiId],
    queryFn: () => api.getEconomicFlowSchematic(projectId!, activePoiId),
    enabled: !!projectId && !!activePoiId && !!schematic && !isError,
  });

  const persistSchematicMut = useMutation({
    mutationFn: (dto: FlowSchematicDto) =>
      api.saveFlowSchematic(projectId!, activePoiId, {
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
      api.saveFlowSchematic(projectId!, activePoiId, {
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
      api.updatePoi(projectId!, activePoiId, { planned_production_volume: volume }),
    onSuccess: (updated) => {
      queryClient.setQueryData<POI[]>(['pois', projectId], (old) =>
        old?.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)) ?? []
      );
    },
    onError: (err) => {
      pushToast('error', err instanceof Error ? err.message : 'Не удалось обновить дебит точки');
    },
  });

  const resetMut = useMutation({
    mutationFn: () => api.resetFlowSchematic(projectId!, activePoiId),
    onSuccess: (data) => {
      queryClient.setQueryData(['flow-schematic', projectId, activePoiId], data);
      void queryClient.invalidateQueries({ queryKey: ['flow-schematic', projectId, activePoiId] });
      void queryClient.invalidateQueries({
        queryKey: ['economic-flow-schematic', projectId, activePoiId],
      });
      void queryClient.invalidateQueries({ queryKey: ['pois', projectId] });
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

  const contextValue = {
    projectId,
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
        <header className="parameters-layout__head flow-schematic-layout__head">
          <div className="flow-schematic-layout__title-row">
            <GitBranch className="text-[var(--accent)] shrink-0" size={28} aria-hidden />
            <div className="min-w-0">
              <h1 className="parameters-layout__title">Схема потоков</h1>
              <p className="parameters-layout__subtitle">
                Технологический и экономический потоки по точке интереса
              </p>
            </div>
          </div>
          {projectId && pois.length > 0 && (
            <div className="flow-schematic-page-select flex items-center gap-2 w-full sm:w-auto">
              <span className="text-sm text-[var(--text-muted)] shrink-0">Точка интереса</span>
              <AppSelect
                value={activePoiId}
                onChange={setSelectedPoiId}
                options={pois.map((p) => ({ value: p.id, label: p.name || p.id }))}
                className="min-w-0 flex-1"
              />
            </div>
          )}
        </header>

        {!projectId && (
          <div className="card p-8 text-center text-[var(--text-muted)]">
            Выберите проект в шапке, чтобы построить схему потоков.
          </div>
        )}

        {projectId && !poisLoading && pois.length === 0 && (
          <div className="card p-8 text-center text-[var(--text-muted)]">
            В проекте нет точек интереса. Добавьте POI на{' '}
            <Link to="/map" className="text-[var(--accent)] underline">
              карте
            </Link>
            .
          </div>
        )}

        {projectId && activePoiId && (
          <>
            {needsNetwork && (
              <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
                {WARNING_LABELS.network_not_built}{' '}
                <Link to="/map" className="font-medium text-[var(--accent)] underline">
                  Перейти на карту
                </Link>
              </div>
            )}

            <nav className="parameters-subnav" aria-label="Разделы схемы потоков">
              {TABS.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `parameters-subnav__tab${isActive ? ' parameters-subnav__tab--active' : ''}`
                  }
                >
                  <Icon size={16} aria-hidden />
                  {label}
                </NavLink>
              ))}
            </nav>

            <Outlet />
          </>
        )}
      </div>
    </FlowSchematicProvider>
  );
}
