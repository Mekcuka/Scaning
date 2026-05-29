import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GitBranch } from 'lucide-react';
import { AppSelect } from '../components/AppSelect';
import { FlowSchematicEditor } from '../components/FlowSchematicEditor';
import { EconomicFlowSchematic } from '../components/EconomicFlowSchematic';
import { api } from '../lib/api';
import type { FlowSchematicDto } from '../lib/flowSchematic';
import { FLUID_COLORS, FLUID_LABELS, WARNING_LABELS } from '../lib/flowSchematic';
import { useAppStore } from '../store';

export function FlowSchematicPage() {
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

  const {
    data: schematic,
    isLoading: schematicLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['flow-schematic', projectId, activePoiId],
    queryFn: () => api.getFlowSchematic(projectId!, activePoiId),
    enabled: !!projectId && !!activePoiId,
  });

  const {
    data: economicSchematic,
    isLoading: economicLoading,
    isError: economicError,
    error: economicErr,
  } = useQuery({
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['flow-schematic', projectId, activePoiId] });
      void queryClient.invalidateQueries({
        queryKey: ['economic-flow-schematic', projectId, activePoiId],
      });
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pois', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['flow-schematic', projectId, activePoiId] });
      void queryClient.invalidateQueries({
        queryKey: ['economic-flow-schematic', projectId, activePoiId],
      });
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

  const needsNetwork = schematic?.warnings.includes('network_not_built');

  return (
    <div className="flow-schematic-page">
      <div className="page-toolbar">
        <div className="page-title-block flex items-center gap-3">
          <GitBranch className="text-[var(--accent)] shrink-0" size={28} />
          <div>
            <h1 className="page-title">Схема потоков</h1>
            <p className="page-subtitle">
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
      </div>

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

          <div className="flow-schematic-windows flex flex-col gap-4">
            <section className="card p-4 flow-schematic-window">
              <div className="flow-schematic-window-head mb-4">
                <h2 className="flow-schematic-window-title">Технологический поток</h2>
                <p className="flow-schematic-window-subtitle text-sm text-[var(--text-muted)] mt-1">
                  PFD: редактирование, рисование связей и сохранение схемы
                </p>
              </div>

              <div className="flex flex-wrap gap-4 text-sm mb-4">
                {(['oil', 'water', 'gas'] as const).map((f) => (
                  <span key={f} className="inline-flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ background: FLUID_COLORS[f] }}
                    />
                    {FLUID_LABELS[f]}
                  </span>
                ))}
                {schematic?.source === 'custom' && (
                  <span className="text-[var(--accent)] font-medium">Пользовательская схема</span>
                )}
              </div>

              {schematicLoading && (
                <p className="text-[var(--text-muted)] py-12 text-center">Загрузка схемы…</p>
              )}
              {isError && (
                <p className="text-red-600 py-8 text-center">
                  {error instanceof Error ? error.message : 'Не удалось загрузить схему'}
                </p>
              )}
              {schematic && !schematicLoading && (
                <FlowSchematicEditor
                  key={schematicEditorKey}
                  schematic={schematic}
                  poi={pois.find((p) => p.id === activePoiId) ?? null}
                  onSave={(dto) => saveMut.mutate(dto)}
                  onPersistCapacity={(dto) => persistSchematicMut.mutate(dto)}
                  onPlannedProductionChange={(volume) => poiProductionMut.mutate(volume)}
                  onReset={() => resetMut.mutate()}
                  saving={saveMut.isPending}
                  resetting={resetMut.isPending}
                  canvasHeightClass="h-[min(40vh,400px)]"
                />
              )}

              {schematic && !schematicLoading && (
                <p className="text-xs text-[var(--text-muted)] mt-3">
                  {schematic.source === 'custom'
                    ? 'Сохранена пользовательская схема. «Сброс» удалит правки и пересчитает схему по POI и сети.'
                    : '«Пересчитать» обновит схему после изменения параметров POI или инфраструктуры на карте.'}
                </p>
              )}
            </section>

            <section className="card p-4 flow-schematic-window">
              <div className="flow-schematic-window-head mb-4">
                <h2 className="flow-schematic-window-title">Экономический поток</h2>
                <p className="flow-schematic-window-subtitle text-sm text-[var(--text-muted)] mt-1">
                  Денежные потоки по цепочке технологической схемы
                </p>
              </div>

              {schematicLoading || economicLoading ? (
                <p className="text-[var(--text-muted)] py-12 text-center">Загрузка…</p>
              ) : economicError ? (
                <p className="text-red-600 py-8 text-center">
                  {economicErr instanceof Error
                    ? economicErr.message
                    : 'Не удалось загрузить экономическую схему'}
                </p>
              ) : economicSchematic ? (
                <EconomicFlowSchematic schematic={economicSchematic} />
              ) : schematic && !isError ? (
                <p className="text-[var(--text-muted)] py-12 text-center">
                  Экономическая схема будет доступна после загрузки технологического потока.
                </p>
              ) : (
                <p className="text-[var(--text-muted)] py-12 text-center">
                  Экономическая схема будет доступна после загрузки технологического потока.
                </p>
              )}
            </section>
          </div>

          {schematic && schematic.warnings.length > 0 && (
            <ul className="text-sm text-[var(--text-muted)] space-y-1 list-disc pl-5">
              {schematic.warnings
                .filter((w) => w !== 'network_not_built' || !needsNetwork)
                .map((w) => (
                  <li key={w}>{WARNING_LABELS[w] ?? w}</li>
                ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
