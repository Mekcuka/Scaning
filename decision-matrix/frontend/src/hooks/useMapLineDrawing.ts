import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import type { DrawMode, MapClickHit, MapFeatureSelection } from '../components/MapView';
import { api, type InfraObject, type InfraObjectCreate } from '../lib/api';
import { applyInfraLineSplit, resolveLineSplitCandidate, type LineSplitHint } from '../lib/applyInfraLineSplit';
import { normalizeLinePathEndpoints } from '../lib/lineEndpointRules';
import {
  isLineEndpointSnapped,
  resolveLineEndpoint,
  snapLineDrawPoint,
} from '../lib/lineEndpointRules';
import { lineDraftFinishCoordinates } from '../lib/mapLineDraftFinish';
import { formatLengthMeters, lineLengthMeters } from '../lib/mapMeasure';
import type { MapUndoEntry } from '../lib/mapUndo';
import { infraGeometryUndo } from '../lib/mapUndo';

export type UseMapLineDrawingParams = {
  projectId: string | undefined;
  drawMode: DrawMode;
  infraSubtype: string;
  infraObjects: InfraObject[];
  canWriteInfra: boolean;
  createInfraMut: UseMutationResult<InfraObject, Error, InfraObjectCreate, unknown>;
  pushToast: (kind: 'success' | 'error' | 'info', message: string) => void;
  pushUndo: (entry: MapUndoEntry) => void;
  upsertInfraInCache: (created: InfraObject) => void;
  nextAutoName: (subtype: string) => string;
  setFeatureSel: (sel: MapFeatureSelection | null) => void;
};

export function useMapLineDrawing({
  projectId,
  drawMode,
  infraSubtype,
  infraObjects,
  canWriteInfra,
  createInfraMut,
  pushToast,
  pushUndo,
  upsertInfraInCache,
  nextAutoName,
  setFeatureSel,
}: UseMapLineDrawingParams) {
  const queryClient = useQueryClient();
  const [lineDraft, setLineDraft] = useState<number[][]>([]);
  const [lineDraftPreview, setLineDraftPreview] = useState<[number, number] | null>(null);
  const [rulerPoints, setRulerPoints] = useState<number[][]>([]);
  const [rulerPreview, setRulerPreview] = useState<[number, number] | null>(null);
  const [rulerCompleted, setRulerCompleted] = useState<number[][][]>([]);
  const rulerClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (drawMode !== 'ruler') {
      setRulerPoints([]);
      setRulerPreview(null);
      setRulerCompleted([]);
    }
  }, [drawMode]);

  useEffect(() => {
    if (drawMode !== 'line') setLineDraftPreview(null);
  }, [drawMode]);

  useEffect(() => {
    if (lineDraft.length === 0) setLineDraftPreview(null);
  }, [lineDraft.length]);

  useEffect(
    () => () => {
      if (rulerClickTimerRef.current) clearTimeout(rulerClickTimerRef.current);
    },
    [],
  );

  const needsDrawCursor =
    (drawMode === 'ruler' && rulerPoints.length >= 1) ||
    (drawMode === 'line' && lineDraft.length >= 1);

  const clearLineDraft = useCallback(() => {
    setLineDraft([]);
    setLineDraftPreview(null);
  }, []);

  const clearRulerState = useCallback(() => {
    setRulerPoints([]);
    setRulerPreview(null);
    setRulerCompleted([]);
  }, []);

  const clearDrawingPreviews = useCallback(() => {
    setLineDraftPreview(null);
    setRulerPreview(null);
  }, []);

  const updatePointerMove = useCallback(
    (lon: number, lat: number, overPoint?: { lon: number; lat: number }) => {
      if (drawMode === 'ruler' && rulerPoints.length >= 1) {
        setRulerPreview([lon, lat]);
      } else if (rulerPreview) {
        setRulerPreview(null);
      }
      if (drawMode === 'line' && lineDraft.length >= 1) {
        setLineDraftPreview(
          snapLineDrawPoint(
            infraSubtype,
            [lon, lat],
            infraObjects,
            overPoint,
            'finish',
          ),
        );
      } else if (lineDraftPreview) {
        setLineDraftPreview(null);
      }
    },
    [
      drawMode,
      rulerPoints.length,
      rulerPreview,
      lineDraft.length,
      lineDraftPreview,
      infraSubtype,
      infraObjects,
    ],
  );

  const finishRulerMeasurement = useCallback(
    (appendPreview = false) => {
      if (rulerClickTimerRef.current) {
        clearTimeout(rulerClickTimerRef.current);
        rulerClickTimerRef.current = null;
      }
      let coords = rulerPoints;
      if (appendPreview && rulerPreview && coords.length >= 1) {
        coords = [...coords, rulerPreview];
      }
      if (coords.length < 2) return;
      setRulerCompleted((prev) => [...prev, coords]);
      setRulerPoints([]);
      setRulerPreview(null);
    },
    [rulerPoints, rulerPreview],
  );

  const handleRulerClick = useCallback((lon: number, lat: number) => {
    const pt: [number, number] = [lon, lat];
    if (rulerClickTimerRef.current) clearTimeout(rulerClickTimerRef.current);
    rulerClickTimerRef.current = setTimeout(() => {
      rulerClickTimerRef.current = null;
      setRulerPoints((prev) => [...prev, pt]);
      setRulerPreview(null);
    }, 220);
  }, []);

  const handleLineClick = useCallback(
    (lon: number, lat: number, hit?: MapClickHit) => {
      if (!canWriteInfra) return;
      const overPoint = hit?.overPoint;
      const endpointKind = lineDraft.length === 0 ? 'start' : 'finish';
      const snapped = snapLineDrawPoint(
        infraSubtype,
        [lon, lat],
        infraObjects,
        overPoint,
        endpointKind,
      );
      if (lineDraft.length === 0) {
        if (!overPoint?.id) {
          pushToast('error', 'Начало линии — клик по точечному объекту на карте');
          return;
        }
        if (!isLineEndpointSnapped(infraSubtype, 'start', snapped, infraObjects)) {
          pushToast('error', 'Начало линии — клик по точечному объекту на карте');
          return;
        }
        setLineDraft([snapped]);
      } else {
        setLineDraft((prev) => [...prev, [lon, lat]]);
      }
      setLineDraftPreview(null);
    },
    [canWriteInfra, infraSubtype, infraObjects, lineDraft.length, pushToast],
  );

  const finishLineDraft = useCallback(
    async (
      coords: number[][],
      finishAt?: { lon: number; lat: number; id?: string },
      splitHint?: LineSplitHint,
    ) => {
      if (!projectId) return;
      if (coords.length < 2) {
        pushToast('info', 'Добавьте минимум 2 точки линии (ЛКМ по карте)');
        return;
      }
      const subtype = infraSubtype;
      const draft = coords.map((c) => [c[0], c[1]] as [number, number]);
      if (finishAt) {
        draft[draft.length - 1] = snapLineDrawPoint(
          subtype,
          [finishAt.lon, finishAt.lat],
          infraObjects,
          finishAt.id
            ? { lon: finishAt.lon, lat: finishAt.lat, id: finishAt.id }
            : null,
          'finish',
        );
      }

      const infraPool =
        queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;
      let pool = infraPool;
      let lineSnapStartId: string | undefined;
      let lineSnapFinishId: string | undefined;

      const applyEndpoint = async (
        index: number,
        kind: 'start' | 'finish',
      ): Promise<boolean> => {
        const resolved = resolveLineEndpoint(subtype, kind, draft[index]!, pool);
        if (!resolved.ok) {
          pushToast('error', resolved.message);
          return false;
        }
        if (resolved.createNode) {
          const splitFound =
            kind === 'finish'
              ? resolveLineSplitCandidate(resolved.lon, resolved.lat, pool, splitHint)
              : null;
          const rLon = splitFound?.snapLon ?? resolved.lon;
          const rLat = splitFound?.snapLat ?? resolved.lat;
          try {
            const node = await api.createInfraObject(projectId, {
              name: nextAutoName('node'),
              subtype: 'node',
              lon: rLon,
              lat: rLat,
            });
            pool = [...pool, node];
            upsertInfraInCache(node);
            draft[index] = [node.lon, node.lat];
            if (kind === 'finish') lineSnapFinishId = node.id;

            if (splitFound) {
              try {
                const splitResult = await applyInfraLineSplit({
                  projectId,
                  split: splitFound,
                  splitLon: rLon,
                  splitLat: rLat,
                });
                if (splitResult) {
                  const { updated, second } = splitResult;
                  upsertInfraInCache(updated);
                  upsertInfraInCache(second);
                  pushUndo({
                    kind: 'split_line_create_point',
                    pointId: node.id,
                    secondLineId: second.id,
                    lineId: splitFound.line.id,
                    lineBefore: infraGeometryUndo(splitFound.line),
                    label: `узел «${node.name}» на «${splitFound.line.name}»`,
                  });
                  pushToast(
                    'success',
                    `Узел «${node.name}» создан; линия «${splitFound.line.name}» разделена на две`,
                  );
                }
              } catch (splitErr) {
                try {
                  await api.deleteInfraObject(projectId, node.id);
                } catch {
                  /* ignore rollback failure */
                }
                pushToast(
                  'error',
                  splitErr instanceof Error
                    ? splitErr.message
                    : 'Не удалось разделить линию в точке узла',
                );
                return false;
              }
            }
          } catch (err) {
            pushToast(
              'error',
              err instanceof Error ? err.message : 'Не удалось создать узел подключения',
            );
            return false;
          }
        } else {
          draft[index] = [resolved.lon, resolved.lat];
          if (resolved.attachedTo) {
            if (kind === 'start') lineSnapStartId = resolved.attachedTo.id;
            else lineSnapFinishId = resolved.attachedTo.id;
          }
        }
        return true;
      };

      if (!(await applyEndpoint(0, 'start'))) return;
      if (!(await applyEndpoint(draft.length - 1, 'finish'))) return;

      const prepared = normalizeLinePathEndpoints(subtype, draft, pool);
      try {
        await createInfraMut.mutateAsync({
          name: nextAutoName(subtype),
          subtype,
          lon: prepared[0][0],
          lat: prepared[0][1],
          end_lon: prepared[prepared.length - 1][0],
          end_lat: prepared[prepared.length - 1][1],
          coordinates: prepared.map(([lo, la]) => [lo, la] as [number, number]),
          ...(lineSnapStartId ? { line_snap_start_object_id: lineSnapStartId } : {}),
          ...(lineSnapFinishId ? { line_snap_finish_object_id: lineSnapFinishId } : {}),
        });
        setFeatureSel(null);
        clearLineDraft();
      } catch (err) {
        pushToast(
          'error',
          err instanceof Error ? err.message : 'Не удалось сохранить линейный объект',
        );
      }
    },
    [
      projectId,
      infraSubtype,
      infraObjects,
      nextAutoName,
      pushToast,
      pushUndo,
      queryClient,
      upsertInfraInCache,
      createInfraMut,
      setFeatureSel,
      clearLineDraft,
    ],
  );

  const lineDraftFinishAt = useCallback(
    () => lineDraftFinishCoordinates(lineDraftPreview),
    [lineDraftPreview],
  );

  const measureCursorLabel = useMemo(() => {
    if (drawMode !== 'ruler' || !rulerPreview || rulerPoints.length < 1) return null;
    const coords = [...rulerPoints, rulerPreview];
    if (coords.length < 2) return null;
    return {
      lon: rulerPreview[0],
      lat: rulerPreview[1],
      text: formatLengthMeters(lineLengthMeters(coords)),
    };
  }, [drawMode, rulerPoints, rulerPreview]);

  const measureAnchorLabels = useMemo(() => {
    const labels = rulerCompleted
      .filter((coords) => coords.length >= 2)
      .map((coords) => {
        const last = coords[coords.length - 1]!;
        return {
          lon: last[0],
          lat: last[1],
          text: formatLengthMeters(lineLengthMeters(coords)),
        };
      });
    if (drawMode === 'ruler' && rulerPoints.length >= 2) {
      const last = rulerPoints[rulerPoints.length - 1]!;
      labels.push({
        lon: last[0],
        lat: last[1],
        text: formatLengthMeters(lineLengthMeters(rulerPoints)),
      });
    }
    return labels;
  }, [drawMode, rulerCompleted, rulerPoints]);

  const drawActionsVisible = drawMode === 'line' || drawMode === 'ruler';
  const drawStepBackDisabled =
    drawMode === 'line'
      ? lineDraft.length === 0
      : drawMode === 'ruler'
        ? rulerPoints.length === 0
        : true;
  const drawFinishDisabled =
    drawMode === 'line'
      ? lineDraft.length < 2 || createInfraMut.isPending
      : drawMode === 'ruler'
        ? rulerPoints.length < 2
        : true;
  const drawResetDisabled =
    drawMode === 'line'
      ? lineDraft.length === 0
      : drawMode === 'ruler'
        ? rulerPoints.length === 0 && rulerCompleted.length === 0
        : true;

  const handleDrawStepBack = useCallback(() => {
    if (drawMode === 'line') setLineDraft((d) => d.slice(0, -1));
    else if (drawMode === 'ruler') setRulerPoints((d) => d.slice(0, -1));
  }, [drawMode]);

  const handleDrawFinish = useCallback(() => {
    if (drawMode === 'line') void finishLineDraft(lineDraft, lineDraftFinishAt());
    else if (drawMode === 'ruler') finishRulerMeasurement(false);
  }, [drawMode, finishLineDraft, lineDraft, lineDraftFinishAt, finishRulerMeasurement]);

  const handleDrawReset = useCallback(() => {
    if (drawMode === 'line') clearLineDraft();
    else if (drawMode === 'ruler') clearRulerState();
  }, [drawMode, clearLineDraft, clearRulerState]);

  const resetDrawingMenus = useCallback(() => {
    clearLineDraft();
  }, [clearLineDraft]);

  const clearDrawingForModeSwitch = useCallback(() => {
    clearLineDraft();
    setRulerPoints([]);
    setRulerPreview(null);
  }, [clearLineDraft]);

  return {
    lineDraft,
    lineDraftPreview,
    rulerPoints,
    rulerPreview,
    rulerCompleted,
    needsDrawCursor,
    clearLineDraft,
    clearRulerState,
    clearDrawingPreviews,
    clearDrawingForModeSwitch,
    resetDrawingMenus,
    updatePointerMove,
    handleRulerClick,
    handleLineClick,
    finishRulerMeasurement,
    finishLineDraft,
    lineDraftFinishAt,
    measureCursorLabel,
    measureAnchorLabels,
    drawActionsVisible,
    drawStepBackDisabled,
    drawFinishDisabled,
    drawResetDisabled,
    handleDrawStepBack,
    handleDrawFinish,
    handleDrawReset,
  };
}
