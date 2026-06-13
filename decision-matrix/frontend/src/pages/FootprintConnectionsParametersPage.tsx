import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Undo2 } from 'lucide-react';
import {
  FootprintLineConnectionTemplateForm,
  templateHasEntries,
} from '../components/parameters/FootprintLineConnectionTemplateForm';
import {
  FootprintConnectionsPageHeader,
  configuredTemplateCount,
} from '../components/parameters/FootprintConnectionsPageHeader';
import { FootprintTemplateApplyConfirmModal } from '../components/parameters/FootprintTemplateApplyConfirmModal';
import { AppSelect } from '../components/AppSelect';
import { defaultMapMutationsApi, SUBTYPE_LABELS, type InfraObject } from '../lib/api';
import {
  applyFootprintTemplateToObject,
  earthworkFootprintConnectionTargets,
  writePointFootprintLineConnections,
} from '../lib/padFootprintLineAttach';
import { patchInfraObjectsInQueries } from '../lib/mapQueries';
import { infraDetailUndo, type InfraDetailUndo } from '../lib/mapUndo';
import { enqueuePendingMapUndo } from '../lib/pendingMapUndoBridge';
import { useAppStore } from '../store';
import { useActiveProject } from '../hooks/useActiveProject';
import { useProjectInfraObjects } from '../hooks/useProjectData';
import { usePermissions } from '../hooks/usePermissions';
import { useProjectFootprintConnectionTemplate } from '../hooks/useProjectFootprintConnectionTemplate';

const ALL_SUBTYPES = '';

type LastApplyUndo = {
  entries: { objectId: string; before: InfraDetailUndo }[];
};

type PendingApply = {
  targets: InfraObject[];
  title: string;
};

function parseApplyProgress(progress: string | null): { done: number; total: number } | null {
  if (!progress) return null;
  const match = progress.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return null;
  return { done: Number(match[1]), total: Number(match[2]) };
}

export function FootprintConnectionsParametersPage() {
  const { canWriteProject } = usePermissions();
  const { projectId } = useActiveProject();
  const pushToast = useAppStore((s) => s.pushToast);
  const queryClient = useQueryClient();
  const [subtypeFilter, setSubtypeFilter] = useState(ALL_SUBTYPES);
  const [applyProgress, setApplyProgress] = useState<string | null>(null);
  const [lastApplyUndo, setLastApplyUndo] = useState<LastApplyUndo | null>(null);
  const [pendingApply, setPendingApply] = useState<PendingApply | null>(null);

  const {
    template,
    isLoading: templateLoading,
    persistTemplateDebounced,
    isSaving: templateSaving,
    saveError,
  } = useProjectFootprintConnectionTemplate(projectId);

  const { data: infraObjects = [], isLoading } = useProjectInfraObjects(projectId, {
    refetchOnMount: 'always',
  });

  const earthworkObjects = useMemo(
    () => earthworkFootprintConnectionTargets(infraObjects),
    [infraObjects],
  );

  const presentSubtypes = useMemo(() => {
    const set = new Set<string>();
    for (const o of earthworkObjects) set.add(o.subtype);
    return [...set].sort((a, b) =>
      (SUBTYPE_LABELS[a] || a).localeCompare(SUBTYPE_LABELS[b] || b, 'ru'),
    );
  }, [earthworkObjects]);

  const subtypeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of earthworkObjects) {
      counts.set(o.subtype, (counts.get(o.subtype) ?? 0) + 1);
    }
    return counts;
  }, [earthworkObjects]);

  const filteredTargets = useMemo(
    () => earthworkFootprintConnectionTargets(infraObjects, subtypeFilter || undefined),
    [infraObjects, subtypeFilter],
  );

  const applyMut = useMutation({
    mutationFn: async (targets: InfraObject[]) => {
      if (!projectId) throw new Error('Проект не выбран');
      let updated = 0;
      let skipped = 0;
      let failed = 0;
      const total = targets.length;
      const undoEntries: { objectId: string; before: InfraDetailUndo }[] = [];

      for (let i = 0; i < targets.length; i += 1) {
        const obj = targets[i]!;
        setApplyProgress(`${i + 1} / ${total}`);
        const connections = applyFootprintTemplateToObject(obj, template, 'merge');
        if (!connections) {
          skipped += 1;
          continue;
        }
        const props = writePointFootprintLineConnections(
          { ...(obj.properties ?? {}) },
          Object.keys(connections).length ? connections : null,
        );
        undoEntries.push({ objectId: obj.id, before: infraDetailUndo(obj) });
        patchInfraObjectsInQueries(queryClient, projectId, (o) =>
          o.id === obj.id ? { ...o, properties: props } : o,
        );
        try {
          await defaultMapMutationsApi.updateInfraObject(projectId, obj.id, { properties: props });
          updated += 1;
        } catch {
          failed += 1;
          patchInfraObjectsInQueries(queryClient, projectId, (o) =>
            o.id === obj.id ? obj : o,
          );
          undoEntries.pop();
        }
      }
      return { updated, skipped, failed, total, undoEntries };
    },
    onSuccess: ({ updated, skipped, failed, total, undoEntries }) => {
      setApplyProgress(null);
      setPendingApply(null);
      const parts = [`Обновлено ${updated} из ${total}`];
      if (skipped > 0) parts.push(`пропущено ${skipped} (нет контура)`);
      if (failed > 0) parts.push(`ошибок ${failed}`);
      pushToast(failed > 0 ? 'error' : 'success', parts.join(', '));

      if (projectId && undoEntries.length > 0) {
        enqueuePendingMapUndo(projectId, {
          kind: 'patch_infra_detail_batch',
          entries: undoEntries,
          label: `шаблон точек подключения (${undoEntries.length})`,
        });
        setLastApplyUndo({ entries: undoEntries });
      } else {
        setLastApplyUndo(null);
      }
    },
    onError: (err: Error) => {
      setApplyProgress(null);
      setPendingApply(null);
      setLastApplyUndo(null);
      pushToast('error', err.message || 'Не удалось применить шаблон');
      if (projectId) void queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
    },
  });

  const undoApplyMut = useMutation({
    mutationFn: async (undo: LastApplyUndo) => {
      if (!projectId) throw new Error('Проект не выбран');
      for (const item of undo.entries) {
        patchInfraObjectsInQueries(queryClient, projectId, (o) =>
          o.id === item.objectId ? { ...o, ...item.before, properties: item.before.properties } : o,
        );
        await defaultMapMutationsApi.updateInfraObject(projectId, item.objectId, {
          properties: item.before.properties,
          name: item.before.name,
          subtype: item.before.subtype,
          layer_id: item.before.layer_id,
          lon: item.before.lon,
          lat: item.before.lat,
        });
      }
    },
    onSuccess: () => {
      setLastApplyUndo(null);
      pushToast('success', 'Применение шаблона отменено');
    },
    onError: (err: Error) => {
      pushToast('error', err.message || 'Не удалось отменить применение');
      if (projectId) void queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
    },
  });

  const requestApply = (targets: InfraObject[], title: string) => {
    if (!canWriteProject || !projectId) return;
    if (!templateHasEntries(template)) {
      pushToast('info', 'Задайте хотя бы один тип линии в шаблоне');
      return;
    }
    if (targets.length === 0) {
      pushToast('info', 'Нет объектов для обновления');
      return;
    }
    setPendingApply({ targets, title });
  };

  if (!projectId) {
    return (
      <div className="parameters-page">
        <div className="card text-sm" style={{ color: 'var(--text-muted)' }}>
          Выберите проект в шапке приложения.
        </div>
      </div>
    );
  }

  const applying = applyMut.isPending;
  const undoing = undoApplyMut.isPending;
  const busy = applying || undoing;
  const progress = parseApplyProgress(applyProgress);
  const progressPct =
    progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  const saveStatus = saveError ? 'error' : templateSaving ? 'saving' : 'idle';

  const filterOptions = [
    { value: ALL_SUBTYPES, label: `Все earthwork-точки (${earthworkObjects.length})` },
    ...presentSubtypes.map((st) => ({
      value: st,
      label: `${SUBTYPE_LABELS[st] ?? st} (${subtypeCounts.get(st) ?? 0})`,
    })),
  ];

  return (
    <div className="parameters-page footprint-connect-page">
      <FootprintConnectionsPageHeader
        canWriteProject={canWriteProject}
        earthworkCount={earthworkObjects.length}
        isLoadingObjects={isLoading}
        configuredCount={configuredTemplateCount(template)}
        saveStatus={saveStatus}
      />

      <div className="footprint-connect-page__grid">
        <section className="card parameters-card footprint-connect-page__template" aria-labelledby="footprint-template-heading">
          <h2 id="footprint-template-heading" className="footprint-connect-section-title">
            Шаблон подключений
          </h2>
          {templateLoading ? (
            <p className="parameters-page__hint">Загрузка шаблона…</p>
          ) : (
            <FootprintLineConnectionTemplateForm
              template={template}
              onChange={persistTemplateDebounced}
              readOnly={!canWriteProject || busy}
            />
          )}
        </section>

        <aside className="card parameters-card footprint-connect-apply-panel" aria-labelledby="footprint-apply-heading">
          <h2 id="footprint-apply-heading" className="footprint-connect-section-title">
            Применить на карте
          </h2>
          <p className="footprint-connect-apply-panel__lead">
            Запишет точки подключения на выбранные earthwork-объекты с учётом поворота каждой
            площадки.
          </p>

          <div className="footprint-connect-apply-panel__filter">
            <AppSelect
              ariaLabel="Фильтр подтипа"
              value={subtypeFilter}
              readOnly={busy || !canWriteProject}
              onChange={setSubtypeFilter}
              options={filterOptions}
              fullWidth
            />
            {!subtypeFilter && (
              <p className="footprint-connect-apply-panel__filter-hint">
                «Применить к подтипу» — выберите конкретный подтип в списке.
              </p>
            )}
          </div>

          <div className="footprint-connect-apply-panel__buttons">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canWriteProject || busy || earthworkObjects.length === 0}
              onClick={() =>
                requestApply(earthworkObjects, 'Применить шаблон ко всем earthwork-точкам?')
              }
            >
              Применить ко всем
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={
                !canWriteProject || busy || !subtypeFilter || filteredTargets.length === 0
              }
              onClick={() =>
                requestApply(
                  filteredTargets,
                  `Применить шаблон к подтипу «${SUBTYPE_LABELS[subtypeFilter] ?? subtypeFilter}»?`,
                )
              }
            >
              Применить к подтипу
            </button>
            {lastApplyUndo && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!canWriteProject || busy}
                onClick={() => undoApplyMut.mutate(lastApplyUndo)}
              >
                <Undo2 size={14} className="inline mr-1" />
                Отменить последнее ({lastApplyUndo.entries.length})
              </button>
            )}
          </div>

          {progress && (
            <div className="map-paste-progress footprint-connect-apply-panel__progress">
              <span className="map-paste-progress-label">
                Применение… {progress.done} / {progress.total}
              </span>
              <div className="map-paste-progress-track" aria-hidden>
                <div
                  className="map-paste-progress-bar"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {earthworkObjects.length === 0 && !isLoading && (
            <p className="parameters-empty footprint-connect-apply-panel__empty">
              Нет точечных объектов с контуром площадки. Добавьте объекты на{' '}
              <Link to="/map">карте</Link> (режим «Площадки»).
            </p>
          )}
        </aside>
      </div>

      <FootprintTemplateApplyConfirmModal
        open={pendingApply != null}
        title={pendingApply?.title ?? ''}
        objectCount={pendingApply?.targets.length ?? 0}
        template={template}
        applying={applying}
        onClose={() => {
          if (!applying) setPendingApply(null);
        }}
        onConfirm={() => {
          if (pendingApply) applyMut.mutate(pendingApply.targets);
        }}
      />
    </div>
  );
}
