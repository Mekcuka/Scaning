import { useCallback, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { DrawMode, MapFeatureSelection, SelectMode } from '../components/MapView';
import { defaultMapMutationsApi, type InfraObject, type MapMutationsApiPort, type POI } from '../lib/api';
import { isLineSubtype } from '../lib/infraGeometry';
import {
  applyOffsetToClipboard,
  buildClipboardFromSelection,
  buildMapBatchPasteRequest,
  batchPasteTimeoutMs,
  clipboardPreviewAt,
  executeMapBatchPaste,
  type MapClipboardItem,
  type MapPasteProgressUpdate,
} from '../lib/mapClipboard';
import { mergeInfraPropertiesForSave } from '../lib/mergeInfraPropertiesForSave';
import { upsertInfraObjectsInQueries } from '../lib/mapQueries';
import type { MapUndoEntry } from '../lib/mapUndo';

export type UseMapClipboardParams = {
  projectId: string | undefined;
  pois: POI[];
  infraObjects: InfraObject[];
  canWriteProject: boolean;
  canWriteInfra: boolean;
  mapEditEnabled: boolean;
  selectMode: SelectMode;
  featureSel: MapFeatureSelection | null;
  featureGroupSel: MapFeatureSelection[];
  mapClipboard: MapClipboardItem[] | null;
  setMapClipboard: (items: MapClipboardItem[] | null) => void;
  pasteMode: boolean;
  setPasteMode: (on: boolean) => void;
  setDrawMode: (mode: DrawMode) => void;
  setSelectMode: (mode: SelectMode) => void;
  setFeatureSel: (sel: MapFeatureSelection | null) => void;
  setFeatureGroupSel: (sels: MapFeatureSelection[]) => void;
  geometrySavePending: number;
  setGeometrySavePending: Dispatch<SetStateAction<number>>;
  cursor: { lon: number; lat: number } | null;
  nextPoiAutoName: (list: POI[]) => string;
  nextAutoName: (subtype: string) => string;
  upsertInfraInCache: (created: InfraObject) => void;
  pushUndo: (entry: MapUndoEntry) => void;
  pushToast: (kind: 'success' | 'error' | 'info', message: string) => void;
  requestDeleteSelection: () => void;
  lineHealSkipIdsRef: MutableRefObject<Set<string>>;
  canDeleteCurrentSelection: boolean;
  mapApi?: MapMutationsApiPort;
};

export function useMapClipboard({
  projectId,
  pois,
  infraObjects,
  canWriteProject,
  canWriteInfra,
  mapEditEnabled,
  selectMode,
  featureSel,
  featureGroupSel,
  mapClipboard,
  setMapClipboard,
  pasteMode,
  setPasteMode,
  setDrawMode,
  setSelectMode,
  setFeatureSel,
  setFeatureGroupSel,
  geometrySavePending,
  setGeometrySavePending,
  cursor,
  nextPoiAutoName,
  nextAutoName,
  pushUndo,
  pushToast,
  requestDeleteSelection,
  lineHealSkipIdsRef,
  canDeleteCurrentSelection,
  mapApi = defaultMapMutationsApi,
}: UseMapClipboardParams) {
  const queryClient = useQueryClient();
  const pasteInFlightRef = useRef(false);
  const [pasteProgress, setPasteProgress] = useState<MapPasteProgressUpdate | null>(null);

  const getActiveMapSelections = useCallback((): MapFeatureSelection[] => {
    if (selectMode === 'box' && featureGroupSel.length > 0) return featureGroupSel;
    if (featureSel) return [featureSel];
    return [];
  }, [selectMode, featureGroupSel, featureSel]);

  const filterSelectionsForCopy = useCallback(
    (selections: MapFeatureSelection[]) => {
      const allowed: MapFeatureSelection[] = [];
      let skipped = 0;
      for (const sel of selections) {
        if (sel.kind === 'poi' && canWriteProject) allowed.push(sel);
        else if (sel.kind === 'infra' && canWriteInfra) allowed.push(sel);
        else skipped += 1;
      }
      return { allowed, skipped };
    },
    [canWriteProject, canWriteInfra],
  );

  const copyMapSelection = useCallback((): boolean => {
    const { allowed, skipped } = filterSelectionsForCopy(getActiveMapSelections());
    if (allowed.length === 0) {
      pushToast('info', 'Нет объектов для копирования');
      return false;
    }
    const items = buildClipboardFromSelection(pois, infraObjects, allowed);
    setMapClipboard(items);
    if (skipped > 0) {
      pushToast('info', `Скопировано ${items.length}; без прав: ${skipped}`);
    } else {
      pushToast('success', `Скопировано объектов: ${items.length}`);
    }
    return true;
  }, [
    filterSelectionsForCopy,
    getActiveMapSelections,
    pois,
    infraObjects,
    pushToast,
    setMapClipboard,
  ]);

  const enterPasteMode = useCallback(() => {
    if (!mapClipboard?.length) {
      pushToast('info', 'Буфер пуст — сначала скопируйте объекты (Ctrl+C)');
      return;
    }
    if (geometrySavePending > 0) {
      pushToast('info', 'Дождитесь сохранения геометрии');
      return;
    }
    setPasteMode(true);
    setDrawMode('select');
    pushToast('info', 'Кликните на карте — место вставки');
  }, [mapClipboard, geometrySavePending, pushToast, setDrawMode, setPasteMode]);

  const executePaste = useCallback(
    async (anchorLon: number, anchorLat: number) => {
      if (pasteInFlightRef.current) {
        pushToast('info', 'Вставка уже выполняется…');
        return;
      }
      if (!projectId || !mapClipboard?.length) return;
      if (geometrySavePending > 0) {
        pushToast('info', 'Дождитесь сохранения геометрии');
        return;
      }
      setPasteMode(false);
      const offsetItems = applyOffsetToClipboard(mapClipboard, anchorLon, anchorLat);
      const batchPayload = buildMapBatchPasteRequest(offsetItems, {
        existingPois: queryClient.getQueryData<POI[]>(['pois', projectId]) ?? pois,
        nextPoiAutoName,
        nextAutoName,
        mergeProperties: mergeInfraPropertiesForSave,
      });

      if (!canWriteProject) batchPayload.pois = [];
      if (!canWriteInfra) {
        batchPayload.infra_points = [];
        batchPayload.infra_lines = [];
      }

      const pendingCount =
        batchPayload.pois.length +
        batchPayload.infra_points.length +
        batchPayload.infra_lines.length;
      if (pendingCount === 0) {
        pushToast('error', 'Не удалось вставить объекты — проверьте права или состав буфера');
        return;
      }

      pasteInFlightRef.current = true;
      setGeometrySavePending((p) => p + 1);
      setPasteProgress({
        label: 'Вставка',
        done: 0,
        total: pendingCount,
        chunkIndex: 0,
        chunkTotal: 1,
        indeterminate: true,
      });
      try {
        const result = await executeMapBatchPaste(
          projectId,
          batchPayload,
          (pid, data) =>
            mapApi.batchPasteMapObjects(pid, data, { timeoutMs: batchPasteTimeoutMs(data) }),
          setPasteProgress,
        );
        const createdPoiIds = result.created_pois.map((p) => p.id);
        const createdInfraIds = result.created_infra.map((o) => o.id);
        const total = createdPoiIds.length + createdInfraIds.length;

        if (total === 0) {
          pushToast('error', 'Не удалось вставить объекты — проверьте права или состав буфера');
          return;
        }

        if (result.created_pois.length > 0) {
          queryClient.setQueriesData<POI[]>({ queryKey: ['pois', projectId] }, (old) => [
            ...(old ?? []),
            ...result.created_pois,
          ]);
        }
        if (result.created_infra.length > 0) {
          upsertInfraObjectsInQueries(queryClient, projectId, result.created_infra);
          for (const obj of result.created_infra) {
            if (isLineSubtype(obj.subtype)) {
              lineHealSkipIdsRef.current.add(obj.id);
            }
          }
        }

        pushUndo({
          kind: 'create_clipboard_group',
          poiIds: createdPoiIds,
          infraIds: createdInfraIds,
          label: `вставка ${total} объектов`,
        });
        pushToast('success', `Вставлено объектов: ${total}`);
        if (total === 1) {
          if (createdPoiIds[0]) {
            setFeatureSel({ kind: 'poi', id: createdPoiIds[0] });
            setSelectMode('single');
            setFeatureGroupSel([]);
          } else if (createdInfraIds[0]) {
            setFeatureSel({ kind: 'infra', id: createdInfraIds[0] });
            setSelectMode('single');
            setFeatureGroupSel([]);
          }
        } else {
          setFeatureSel(null);
          setFeatureGroupSel([]);
        }
      } catch (e) {
        pushToast('error', e instanceof Error ? e.message : 'Не удалось вставить объекты');
      } finally {
        pasteInFlightRef.current = false;
        setPasteProgress(null);
        setGeometrySavePending((p) => Math.max(0, p - 1));
      }
    },
    [
      projectId,
      mapClipboard,
      geometrySavePending,
      queryClient,
      pois,
      canWriteProject,
      canWriteInfra,
      nextPoiAutoName,
      nextAutoName,
      pushUndo,
      pushToast,
      setPasteMode,
      setGeometrySavePending,
      setFeatureSel,
      setSelectMode,
      setFeatureGroupSel,
      lineHealSkipIdsRef,
    ],
  );

  const cutMapSelection = useCallback(() => {
    if (!copyMapSelection()) return;
    requestDeleteSelection();
  }, [copyMapSelection, requestDeleteSelection]);

  const clipboardPreviewPoints = useMemo(() => {
    if (!pasteMode || !mapClipboard?.length || !cursor) return [];
    return clipboardPreviewAt(mapClipboard, cursor.lon, cursor.lat);
  }, [pasteMode, mapClipboard, cursor]);

  const hasMapSelection = getActiveMapSelections().length > 0;
  const canCopyMapSelection =
    mapEditEnabled && hasMapSelection && (canWriteProject || canWriteInfra);
  const canPasteMapClipboard = mapEditEnabled && (mapClipboard?.length ?? 0) > 0;
  const canCutMapSelection = canCopyMapSelection && canDeleteCurrentSelection;

  return {
    copyMapSelection,
    enterPasteMode,
    executePaste,
    cutMapSelection,
    clipboardPreviewPoints,
    canCopyMapSelection,
    canPasteMapClipboard,
    canCutMapSelection,
    pasteProgress,
  };
}
