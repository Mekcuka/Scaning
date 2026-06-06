import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MapGroupSelectionItem } from '../components/MapGroupSelectionPanel';
import type { MapClickHit, MapFeatureSelection } from '../components/MapView';
import type { AutoroadConfirmVariant } from '../components/AutoroadConnectConfirmModal';
import {
  type AutoroadNetworkPickMode,
  infraObjectInBbox,
  isAutoroadNetworkTerminal,
  isEligibleAutoroadTerminalObject,
  mergeTerminalIds,
} from '../lib/autoroadNetwork';
import {
  DEFAULT_AUTOROAD_PLANNER_OPTIONS,
  loadAutoroadPlannerOptions,
  plannerOptionsToRequestOptions,
  saveAutoroadPlannerOptions,
  type AutoroadPlannerOptions,
} from '../lib/autoroadNetworkPlannerOptions';
import {
  linesFromNetworkPlanResponse,
  networkPlanToConnectPreview,
  type AutoroadPlanPreviewLine,
} from '../lib/autoroadPlanPreview';
import {
  api,
  syncClientAuthSession,
  SUBTYPE_LABELS,
  type AutoroadConnectResult,
  type AutoroadNetworkApplyResult,
  type InfraObject,
} from '../lib/api';
import { isLineSubtype } from '../lib/infraGeometry';
import { refreshMapQueries } from '../lib/mapQueries';
import { isProjectJobCreateResponse, pollProjectJobUntilDone } from '../lib/pollProjectJob';
import { taskLog } from '../lib/taskLog/store';
import type { MapUndoEntry } from '../lib/mapUndo';

type DrawMode = 'select' | 'point' | 'line' | 'poi' | 'ruler' | 'autoroad_network';

function applyResultCounts(result: AutoroadNetworkApplyResult | AutoroadConnectResult | null | undefined): {
  createdLines: number;
  createdNodes: number;
} {
  return {
    createdLines: result?.created_lines ?? 0,
    createdNodes: result?.created_nodes ?? 0,
  };
}

function plannedSegmentCount(plan: { new_line_count?: number; new_node_count?: number }): number {
  return (plan.new_line_count ?? 0) + (plan.new_node_count ?? 0);
}

export type UseMapAutoroadNetworkParams = {
  projectId: string | undefined;
  drawMode: DrawMode;
  setDrawMode: (mode: DrawMode) => void;
  infraObjects: InfraObject[];
  mapBbox: string | null;
  groupSelectionDetails: MapGroupSelectionItem[];
  canWriteInfra: boolean;
  projectJobBusy: boolean;
  requestAutoroadConfirm: (
    preview: AutoroadConnectResult,
    variant: AutoroadConfirmVariant,
  ) => Promise<boolean>;
  pushToast: (kind: 'success' | 'error' | 'info', message: string) => void;
  pushUndo: (entry: MapUndoEntry) => void;
  invalidateMap: () => void;
};

export function useMapAutoroadNetwork({
  projectId,
  drawMode,
  setDrawMode,
  infraObjects,
  mapBbox,
  groupSelectionDetails,
  canWriteInfra,
  projectJobBusy,
  requestAutoroadConfirm,
  pushToast,
  pushUndo,
  invalidateMap,
}: UseMapAutoroadNetworkParams) {
  const queryClient = useQueryClient();
  const [terminalIds, setTerminalIds] = useState<string[]>([]);
  const [pickMode, setPickMode] = useState<AutoroadNetworkPickMode>('click');
  const [plannerOptions, setPlannerOptions] = useState<AutoroadPlannerOptions>(
    () => DEFAULT_AUTOROAD_PLANNER_OPTIONS,
  );
  const [solverStatusLoading, setSolverStatusLoading] = useState(false);
  const [solverStatus, setSolverStatus] = useState<{
    steinerpy: boolean;
    geosteiner: boolean;
    default_solver: string;
  } | null>(null);
  const [planPreviewLines, setPlanPreviewLines] = useState<AutoroadPlanPreviewLine[]>([]);

  const clearTerminals = useCallback(() => setTerminalIds([]), []);

  useEffect(() => {
    if (!projectId) return;
    setPlannerOptions(loadAutoroadPlannerOptions(projectId));
  }, [projectId]);

  useEffect(() => {
    if (drawMode !== 'autoroad_network') {
      setTerminalIds([]);
      setPlanPreviewLines([]);
      setPickMode('click');
    }
  }, [drawMode]);

  useEffect(() => {
    if (drawMode !== 'autoroad_network' || !projectId) return;
    let cancelled = false;
    setSolverStatusLoading(true);
    void api
      .autoroadNetworkSolverStatus()
      .then((status) => {
        if (cancelled) return;
        setSolverStatus(status);
        setPlannerOptions((prev) => {
          let solver = prev.solver;
          if (solver === 'geosteiner' && !status.geosteiner && status.steinerpy) {
            solver = 'steinerpy';
          } else if (solver === 'steinerpy' && !status.steinerpy && status.geosteiner) {
            solver = 'geosteiner';
          }
          if (solver === prev.solver) return prev;
          const next = { ...prev, solver };
          saveAutoroadPlannerOptions(projectId, next);
          return next;
        });
      })
      .catch(() => {
        if (!cancelled) setSolverStatus(null);
      })
      .finally(() => {
        if (!cancelled) setSolverStatusLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [drawMode, projectId]);

  const handlePlannerOptionsChange = useCallback(
    (next: AutoroadPlannerOptions) => {
      setPlannerOptions(next);
      if (projectId) saveAutoroadPlannerOptions(projectId, next);
    },
    [projectId],
  );

  const connectObjectIds = useMemo(() => {
    return groupSelectionDetails
      .filter(
        (item) =>
          item.kind === 'infra' &&
          item.subtype != null &&
          !isLineSubtype(item.subtype) &&
          isAutoroadNetworkTerminal(item.kind, item.subtype),
      )
      .map((item) => item.id);
  }, [groupSelectionDetails]);

  const networkDetails = useMemo((): MapGroupSelectionItem[] => {
    const byId = new Map(infraObjects.map((o) => [o.id, o]));
    const out: MapGroupSelectionItem[] = [];
    for (const id of terminalIds) {
      const o = byId.get(id);
      if (!o) continue;
      out.push({
        id: o.id,
        name: o.name,
        kind: 'infra',
        subtype: o.subtype,
        subtitle: o.subtype,
      });
    }
    return out;
  }, [terminalIds, infraObjects]);

  const eligibleTerminals = useMemo(
    () => infraObjects.filter(isEligibleAutoroadTerminalObject),
    [infraObjects],
  );

  const visibleEligibleTerminals = useMemo(() => {
    if (!mapBbox) return eligibleTerminals;
    return eligibleTerminals.filter((o) => infraObjectInBbox(o, mapBbox));
  }, [eligibleTerminals, mapBbox]);

  const subtypeBulkOptions = useMemo(() => {
    const bySubtype = new Map<string, { projectCount: number; visibleCount: number }>();
    for (const obj of eligibleTerminals) {
      const row = bySubtype.get(obj.subtype) ?? { projectCount: 0, visibleCount: 0 };
      row.projectCount += 1;
      if (!mapBbox || infraObjectInBbox(obj, mapBbox)) row.visibleCount += 1;
      bySubtype.set(obj.subtype, row);
    }
    return [...bySubtype.entries()]
      .sort(([a], [b]) =>
        (SUBTYPE_LABELS[a] || a).localeCompare(SUBTYPE_LABELS[b] || b, 'ru'),
      )
      .map(([subtype, counts]) => ({
        subtype,
        label: SUBTYPE_LABELS[subtype] || subtype,
        projectCount: counts.projectCount,
        visibleCount: counts.visibleCount,
      }));
  }, [eligibleTerminals, mapBbox]);

  const appendTerminals = useCallback((ids: Iterable<string>) => {
    setTerminalIds((prev) => mergeTerminalIds(prev, ids));
  }, []);

  const handleDragBoxPick = useCallback(
    (selections: MapFeatureSelection[]) => {
      const added = selections
        .filter((sel) => sel.kind === 'infra')
        .map((sel) => sel.id)
        .filter((id) => {
          const obj = infraObjects.find((o) => o.id === id);
          return obj != null && isEligibleAutoroadTerminalObject(obj);
        });
      if (added.length === 0) {
        pushToast('info', 'В рамке нет подходящих точечных объектов');
        return;
      }
      appendTerminals(added);
      pushToast('success', `Добавлено терминалов: ${added.length}`);
    },
    [appendTerminals, infraObjects, pushToast],
  );

  const handleAddVisible = useCallback(() => {
    const ids = visibleEligibleTerminals.map((o) => o.id);
    if (ids.length === 0) {
      pushToast('info', 'В видимой области нет подходящих объектов');
      return;
    }
    setTerminalIds((prev) => {
      const next = mergeTerminalIds(prev, ids);
      const added = next.length - prev.length;
      if (added > 0) {
        pushToast('success', `Добавлено терминалов: ${added}`);
      } else {
        pushToast('info', `Все ${ids.length} уже в списке`);
      }
      return next;
    });
  }, [pushToast, visibleEligibleTerminals]);

  const handleAddBySubtype = useCallback(
    (subtype: string) => {
      const pool = mapBbox ? visibleEligibleTerminals : eligibleTerminals;
      const ids = pool.filter((o) => o.subtype === subtype).map((o) => o.id);
      if (ids.length === 0) {
        pushToast('info', 'Нет объектов выбранного типа в текущей области');
        return;
      }
      const label = SUBTYPE_LABELS[subtype] || subtype;
      setTerminalIds((prev) => {
        const next = mergeTerminalIds(prev, ids);
        const added = next.length - prev.length;
        if (added > 0) {
          pushToast('success', `Добавлено «${label}»: ${added}`);
        } else {
          pushToast('info', `Все объекты «${label}» уже в списке`);
        }
        return next;
      });
    },
    [eligibleTerminals, mapBbox, pushToast, visibleEligibleTerminals],
  );

  const handleMapClick = useCallback(
    (hit?: MapClickHit) => {
      if (!canWriteInfra) return false;
      const over = hit?.overPoint;
      if (!over?.id) {
        pushToast('info', 'Кликните по точечному объекту инфраструктуры');
        return true;
      }
      const obj = infraObjects.find((o) => o.id === over.id);
      if (!obj) return true;
      if (!isAutoroadNetworkTerminal('infra', obj.subtype)) {
        pushToast('info', 'Узлы (Узел / метанол / ЛЭП) не выбираются — только перекрёстки');
        return true;
      }
      setTerminalIds((ids) =>
        ids.includes(obj.id) ? ids.filter((x) => x !== obj.id) : [...ids, obj.id],
      );
      return true;
    },
    [canWriteInfra, infraObjects, pushToast],
  );

  const canConnect =
    canWriteInfra &&
    !projectJobBusy &&
    connectObjectIds.length >= 2 &&
    connectObjectIds.length === groupSelectionDetails.length;

  const connectMut = useMutation({
    mutationFn: async (objectIds: string[]) => {
      const flowId = taskLog.startHttpFlow(
        projectId!,
        'autoroad_connect',
        'Соединение автодорогами',
      );
      try {
        const preview = (await api.autoroadConnect(projectId!, {
          object_ids: objectIds,
          dry_run: true,
        })) as AutoroadConnectResult;
        if (!(await requestAutoroadConfirm(preview, 'connect'))) {
          taskLog.endHttpFlow(flowId, 'cancelled');
          return null;
        }
        const applyRes = await api.autoroadConnect(projectId!, {
          object_ids: objectIds,
          dry_run: false,
        });
        if (isProjectJobCreateResponse(applyRes)) {
          const job = await pollProjectJobUntilDone(projectId!, applyRes.job_id, {
            timeoutMs: 600_000,
          });
          taskLog.endHttpFlow(flowId, 'completed');
          return job.result as unknown as AutoroadConnectResult;
        }
        taskLog.endHttpFlow(flowId, 'completed');
        return applyRes;
      } catch (e) {
        taskLog.endHttpFlow(flowId, 'failed');
        throw e;
      }
    },
    onSuccess: (result) => {
      if (!result) return;
      void queryClient.invalidateQueries({ queryKey: ['activeJob', projectId] });
      const createdIds = [...(result.created_line_ids ?? []), ...(result.created_node_ids ?? [])];
      if (createdIds.length > 0) {
        pushUndo({
          kind: 'create_clipboard_group',
          poiIds: [],
          infraIds: createdIds,
          label: 'соединение автодорогами',
        });
      }
      const parts: string[] = [];
      if (result.created_lines > 0) parts.push(`${result.created_lines} линий`);
      if (result.created_nodes > 0) parts.push(`${result.created_nodes} узлов`);
      pushToast(
        'success',
        parts.length > 0
          ? `Соединение выполнено: ${parts.join(', ')}`
          : 'Объекты уже связаны по существующей сети',
      );
      invalidateMap();
    },
    onError: (err) => {
      pushToast('error', err instanceof Error ? err.message : 'Не удалось соединить автодорогами');
    },
  });

  const handleConnect = useCallback(() => {
    if (!canConnect || connectMut.isPending) return;
    connectMut.mutate(connectObjectIds);
  }, [canConnect, connectMut, connectObjectIds]);

  const runNetworkFlow = useMutation({
    mutationFn: async (objectIds: string[]) => {
      if (!(await syncClientAuthSession())) {
        throw new Error('Сессия истекла. Войдите снова и повторите расчёт.');
      }
      const flowId = taskLog.startHttpFlow(
        projectId!,
        'autoroad_network',
        'Построение сети автодорог',
      );
      try {
        const planRequest = await api.autoroadNetworkBuildRequest(projectId!, {
          object_ids: objectIds,
          full_network_rebuild: true,
        });
        planRequest.options = {
          ...planRequest.options,
          ...plannerOptionsToRequestOptions(plannerOptions),
        };
        const plan = await api.autoroadNetworkCompute(projectId!, planRequest);
        const plannedTotal = plannedSegmentCount(plan);
        setPlanPreviewLines(linesFromNetworkPlanResponse(plan));
        const previewForModal = networkPlanToConnectPreview(plan);
        if (!(await requestAutoroadConfirm(previewForModal, 'network'))) {
          setPlanPreviewLines([]);
          taskLog.endHttpFlow(flowId, 'cancelled');
          return null;
        }
        const applyRes = await api.autoroadNetworkApply(projectId!, {
          object_ids: objectIds,
          plan,
          full_network_rebuild: true,
        });
        let result: AutoroadNetworkApplyResult | null = null;
        if (isProjectJobCreateResponse(applyRes)) {
          const job = await pollProjectJobUntilDone(projectId!, applyRes.job_id, {
            timeoutMs: 600_000,
          });
          if (job.status === 'failed') {
            throw new Error(job.error_message ?? 'Не удалось применить сеть на карте');
          }
          result = (job.result ?? null) as AutoroadNetworkApplyResult | null;
        } else {
          result = applyRes;
        }
        const { createdLines, createdNodes } = applyResultCounts(result);
        if (plannedTotal > 0 && createdLines + createdNodes === 0) {
          throw new Error(
            'Расчёт выполнен, но новые объекты не сохранены на карте. Подтвердите применение в диалоге и дождитесь завершения фоновой задачи.',
          );
        }
        taskLog.endHttpFlow(flowId, 'completed');
        return result;
      } catch (e) {
        taskLog.endHttpFlow(flowId, 'failed');
        throw e;
      }
    },
    onSuccess: async (result) => {
      setPlanPreviewLines([]);
      if (!result) return;
      void queryClient.invalidateQueries({ queryKey: ['activeJob', projectId] });
      const { createdLines, createdNodes } = applyResultCounts(result);
      const createdIds = [...(result.created_line_ids ?? []), ...(result.created_node_ids ?? [])];
      if (createdIds.length > 0) {
        pushUndo({
          kind: 'create_clipboard_group',
          poiIds: [],
          infraIds: createdIds,
          label: 'построение сети автодорог',
        });
      }
      if (createdLines > 0 || createdNodes > 0) {
        pushToast(
          'success',
          `Сеть построена: ${createdLines} линий, ${createdNodes} узлов`,
        );
      } else {
        pushToast('info', 'Объекты уже связаны по существующей сети — новых линий не добавлено');
      }
      setTerminalIds([]);
      setDrawMode('select');
      invalidateMap();
      if (projectId) {
        await refreshMapQueries(queryClient, projectId);
      }
    },
    onError: (err) => {
      setPlanPreviewLines([]);
      pushToast('error', err instanceof Error ? err.message : 'Не удалось построить сеть');
    },
  });

  const canPreview = canWriteInfra && !projectJobBusy && terminalIds.length >= 2;

  const disabledHint = useMemo((): string | null => {
    if (canPreview) return null;
    if (!canWriteInfra) return 'Нет прав на изменение инфраструктуры в этом проекте.';
    if (projectJobBusy) {
      return 'Дождитесь завершения фоновой задачи (кнопка «Журнал задач» в шапке).';
    }
    if (terminalIds.length < 2) {
      return 'Выберите минимум 2 точечных объекта на карте (клик по объекту).';
    }
    return null;
  }, [canPreview, canWriteInfra, projectJobBusy, terminalIds.length]);

  return {
    terminalIds,
    setTerminalIds,
    clearTerminals,
    pickMode,
    setPickMode,
    plannerOptions,
    handlePlannerOptionsChange,
    solverStatus,
    solverStatusLoading,
    planPreviewLines,
    networkDetails,
    visibleEligibleTerminals,
    subtypeBulkOptions,
    handleDragBoxPick,
    handleAddVisible,
    handleAddBySubtype,
    handleMapClick,
    canConnect,
    connectMut,
    handleConnect,
    runNetworkFlow,
    canPreview,
    disabledHint,
  };
}
