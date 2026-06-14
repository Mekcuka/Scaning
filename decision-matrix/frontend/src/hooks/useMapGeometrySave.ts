import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { MapFeatureSelection } from '../components/MapView';
import {
  defaultMapMutationsApi,
  defaultProjectsPoiWriteApi,
  LINE_SUBTYPES,
  type InfraObject,
  type InfraObjectCreate,
  type MapMutationsApiPort,
  type POI,
  type ProjectsPoiWriteApiPort,
} from '../lib/api';
import { isLineSubtype } from '../lib/infraGeometry';
import { linkCoordMatch, lineCoordsOrEndpoints } from '../lib/infraLinks';
import {
  accumulateLineEndpointPatches,
  buildMovedPositionsMap,
  constrainGroupMovedLine,
  lineEndpointPatchesToResults,
  type MovedPointUpdate,
} from '../lib/mapGroupLinePatches';
import { patchInfraObjectsInQueries } from '../lib/mapQueries';
import {
  constrainLineCoordinatesOnEdit,
  lineEndpointAttachmentsFromObject,
  normalizeLinePathEndpoints,
} from '../lib/lineEndpointRules';
import type { MapUndoEntry } from '../lib/mapUndo';
import { infraGeometryUndo, poiGeometryUndo } from '../lib/mapUndo';

export type UseMapGeometrySaveParams = {
  projectId: string | undefined;
  pois: POI[];
  infraObjects: InfraObject[];
  pushUndo: (entry: MapUndoEntry) => void;
  pushToast: (kind: 'success' | 'error' | 'info', message: string) => void;
  invalidateMap: () => void;
  touchInfraOverlay: (ids: Iterable<string>) => void;
  mapApi?: MapMutationsApiPort;
  poiApi?: ProjectsPoiWriteApiPort;
};

export function useMapGeometrySave({
  projectId,
  pois,
  infraObjects,
  pushUndo,
  pushToast,
  invalidateMap,
  touchInfraOverlay,
  mapApi = defaultMapMutationsApi,
  poiApi = defaultProjectsPoiWriteApi,
}: UseMapGeometrySaveParams) {
  const queryClient = useQueryClient();
  const [geometrySavePending, setGeometrySavePending] = useState(0);
  const geometrySaveSeqRef = useRef(0);

  const handleGeometryChange = useCallback(
    async (sel: MapFeatureSelection, lon: number, lat: number, coords?: number[][]) => {
      if (!projectId) return;
      const saveSeq = ++geometrySaveSeqRef.current;
      const rLon = lon;
      const rLat = lat;

      const poiBefore =
        sel.kind === 'poi'
          ? queryClient.getQueryData<POI[]>(['pois', projectId])?.find((p) => p.id === sel.id) ??
            pois.find((p) => p.id === sel.id)
          : null;
      const infraBefore =
        sel.kind === 'infra'
          ? queryClient.getQueryData<InfraObject[]>(['infra', projectId])?.find((o) => o.id === sel.id) ??
            infraObjects.find((o) => o.id === sel.id)
          : null;

      let lineRollbackPatches: {
        id: string;
        before: {
          lon: number;
          lat: number;
          end_lon?: number | null;
          end_lat?: number | null;
          coordinates?: number[][] | null;
        };
      }[] = [];

      setGeometrySavePending((p) => p + 1);
      try {
        if (sel.kind === 'poi') {
          queryClient.setQueriesData<POI[]>({ queryKey: ['pois', projectId] }, (old) =>
            old?.map((p) => (p.id === sel.id ? { ...p, lon: rLon, lat: rLat } : p)) ?? [],
          );
          await poiApi.updatePoi(projectId, sel.id, { lon: rLon, lat: rLat });
          if (saveSeq !== geometrySaveSeqRef.current) return;
          if (poiBefore) {
            pushUndo({
              kind: 'patch_poi_geometry',
              poiId: sel.id,
              before: poiGeometryUndo(poiBefore),
              label: `перемещение «${poiBefore.name}»`,
            });
          }
        } else if (coords && coords.length >= 2) {
          let roundedCoords = coords.map(([lo, la]) => [lo, la] as [number, number]);
          const currentInfra =
            queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;
          const pointPool = currentInfra.filter((o) => o.id !== sel.id);
          if (infraBefore && isLineSubtype(infraBefore.subtype)) {
            const endpoints = lineEndpointAttachmentsFromObject(infraBefore, pointPool);
            if (endpoints) {
              const constrained = constrainLineCoordinatesOnEdit({
                lineSubtype: infraBefore.subtype,
                originalStart: endpoints.start,
                originalFinish: endpoints.finish,
                originalStartAttach: endpoints.startAttach,
                originalFinishAttach: endpoints.finishAttach,
                draftCoords: roundedCoords,
                infraObjects: pointPool,
              });
              roundedCoords = constrained.coords.map(([lo, la]) => [lo, la] as [number, number]);
              roundedCoords = normalizeLinePathEndpoints(
                infraBefore.subtype,
                roundedCoords,
                pointPool,
              );
            }
          }
          const payload = {
            lon: roundedCoords[0][0],
            lat: roundedCoords[0][1],
            end_lon: roundedCoords[roundedCoords.length - 1][0],
            end_lat: roundedCoords[roundedCoords.length - 1][1],
            coordinates: roundedCoords,
          };
          patchInfraObjectsInQueries(queryClient, projectId, (o) =>
            o.id === sel.id ? { ...o, ...payload } : o,
          );
          touchInfraOverlay([sel.id]);
          await mapApi.updateInfraObject(projectId, sel.id, payload);
          if (saveSeq !== geometrySaveSeqRef.current) return;
          if (infraBefore) {
            pushUndo({
              kind: 'patch_infra_geometry',
              objectId: sel.id,
              before: infraGeometryUndo(infraBefore),
              label: `изменение геометрии «${infraBefore.name}»`,
            });
          }
        } else {
          const isMovedPoint =
            !!infraBefore && !LINE_SUBTYPES.includes(infraBefore.subtype as (typeof LINE_SUBTYPES)[number]);
          const updatedLinePayloads: {
            id: string;
            payload: Partial<InfraObjectCreate>;
            before: {
              lon: number;
              lat: number;
              end_lon?: number | null;
              end_lat?: number | null;
              coordinates?: number[][] | null;
            };
          }[] = [];
          if (isMovedPoint && infraBefore) {
            const oldLon = infraBefore.lon;
            const oldLat = infraBefore.lat;
            const currentInfra =
              queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;
            const candidateLines = currentInfra.filter(
              (o) =>
                o.id !== sel.id &&
                LINE_SUBTYPES.includes(o.subtype as (typeof LINE_SUBTYPES)[number]),
            );

            for (const line of candidateLines) {
              const lineCoords = lineCoordsOrEndpoints(line);
              if (!lineCoords || lineCoords.length < 2) continue;
              const first = lineCoords[0]!;
              const last = lineCoords[lineCoords.length - 1]!;
              const firstMatches =
                linkCoordMatch(first[0], oldLon) && linkCoordMatch(first[1], oldLat);
              const lastMatches =
                linkCoordMatch(last[0], oldLon) && linkCoordMatch(last[1], oldLat);
              if (!firstMatches && !lastMatches) continue;

              const shifted = lineCoords.map(([lo, la], i) => {
                if (i === 0 && firstMatches) return [rLon, rLat] as [number, number];
                if (i === lineCoords.length - 1 && lastMatches) return [rLon, rLat] as [number, number];
                return [lo, la] as [number, number];
              });
              const payload = {
                lon: shifted[0][0],
                lat: shifted[0][1],
                end_lon: shifted[shifted.length - 1][0],
                end_lat: shifted[shifted.length - 1][1],
                coordinates: shifted,
              };
              updatedLinePayloads.push({
                id: line.id,
                payload,
                before: {
                  lon: line.lon,
                  lat: line.lat,
                  end_lon: line.end_lon,
                  end_lat: line.end_lat,
                  coordinates: line.coordinates,
                },
              });
            }
          }

          lineRollbackPatches = updatedLinePayloads.map((linePatch) => ({
            id: linePatch.id,
            before: linePatch.before,
          }));

          const touchedIds = new Set<string>([sel.id, ...updatedLinePayloads.map((p) => p.id)]);
          patchInfraObjectsInQueries(queryClient, projectId, (o) => {
            if (o.id === sel.id) return { ...o, lon: rLon, lat: rLat };
            const linePatch = updatedLinePayloads.find((p) => p.id === o.id);
            return linePatch ? { ...o, ...linePatch.payload } : o;
          });
          touchInfraOverlay(touchedIds);
          await mapApi.updateInfraObject(projectId, sel.id, { lon: rLon, lat: rLat });
          for (const linePatch of updatedLinePayloads) {
            await mapApi.updateInfraObject(projectId, linePatch.id, linePatch.payload);
          }
          if (saveSeq !== geometrySaveSeqRef.current) return;
          if (infraBefore) {
            if (updatedLinePayloads.length > 0) {
              pushUndo({
                kind: 'patch_infra_batch',
                entries: [
                  { objectId: sel.id, before: infraGeometryUndo(infraBefore) },
                  ...updatedLinePayloads.map((linePatch) => ({
                    objectId: linePatch.id,
                    before: linePatch.before,
                  })),
                ],
                label: `перемещение «${infraBefore.name}»`,
              });
            } else {
              pushUndo({
                kind: 'patch_infra_geometry',
                objectId: sel.id,
                before: infraGeometryUndo(infraBefore),
                label: `перемещение «${infraBefore.name}»`,
              });
            }
          }
        }
      } catch (e) {
        if (saveSeq !== geometrySaveSeqRef.current) return;
        pushToast('error', e instanceof Error ? e.message : 'Не удалось сохранить геометрию');
        if (poiBefore) {
          queryClient.setQueriesData<POI[]>({ queryKey: ['pois', projectId] }, (old) =>
            old?.map((p) => (p.id === sel.id ? poiBefore : p)) ?? [],
          );
        }
        if (infraBefore) {
          queryClient.setQueriesData<InfraObject[]>({ queryKey: ['infra', projectId] }, (old) =>
            old?.map((o) => {
              if (o.id === sel.id) return infraBefore;
              const linePatch = lineRollbackPatches.find((p) => p.id === o.id);
              if (linePatch) return { ...o, ...linePatch.before };
              return o;
            }) ?? [],
          );
        }
      } finally {
        if (saveSeq === geometrySaveSeqRef.current) {
          setGeometrySavePending((p) => Math.max(0, p - 1));
        }
      }
    },
    [projectId, queryClient, pois, infraObjects, pushUndo, pushToast, touchInfraOverlay, mapApi, poiApi],
  );

  const handleBatchGeometryChange = useCallback(
    async (
      items: { sel: MapFeatureSelection; lon: number; lat: number; coords?: number[][] }[],
    ) => {
      if (!projectId || items.length === 0) return;

      const currentInfra =
        queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;
      const currentPois = queryClient.getQueryData<POI[]>(['pois', projectId]) ?? pois;

      const poiEntries: { poiId: string; before: ReturnType<typeof poiGeometryUndo> }[] = [];
      const infraEntries: { objectId: string; before: ReturnType<typeof infraGeometryUndo> }[] = [];

      const poiSaves: { id: string; lon: number; lat: number }[] = [];
      const pointSaves: { id: string; lon: number; lat: number; before: InfraObject }[] = [];
      const lineSaves: { id: string; payload: Partial<InfraObjectCreate>; before: InfraObject }[] =
        [];
      const pendingLineMoves: {
        id: string;
        coords: number[][];
        infraBefore: InfraObject;
      }[] = [];

      const movedLineIds = new Set<string>();
      const movedPointUpdates: MovedPointUpdate[] = [];
      const movedPositionEntries: { id: string; lon: number; lat: number }[] = [];

      for (const item of items) {
        const { sel, lon: rLon, lat: rLat, coords } = item;
        if (sel.kind === 'poi') {
          const poiBefore = currentPois.find((p) => p.id === sel.id);
          if (!poiBefore) continue;
          poiEntries.push({ poiId: sel.id, before: poiGeometryUndo(poiBefore) });
          poiSaves.push({ id: sel.id, lon: rLon, lat: rLat });
          movedPositionEntries.push({ id: sel.id, lon: rLon, lat: rLat });
          continue;
        }

        const infraBefore = currentInfra.find((o) => o.id === sel.id);
        if (!infraBefore) continue;

        if (coords && coords.length >= 2) {
          movedLineIds.add(sel.id);
          movedPositionEntries.push({ id: sel.id, lon: rLon, lat: rLat });
          pendingLineMoves.push({ id: sel.id, coords, infraBefore });
          continue;
        }

        if (LINE_SUBTYPES.includes(infraBefore.subtype as (typeof LINE_SUBTYPES)[number])) continue;

        infraEntries.push({ objectId: sel.id, before: infraGeometryUndo(infraBefore) });
        pointSaves.push({ id: sel.id, lon: rLon, lat: rLat, before: infraBefore });
        movedPointUpdates.push({
          id: sel.id,
          oldLon: infraBefore.lon,
          oldLat: infraBefore.lat,
          newLon: rLon,
          newLat: rLat,
        });
        movedPositionEntries.push({ id: sel.id, lon: rLon, lat: rLat });
      }

      const movedPositions = buildMovedPositionsMap(movedPositionEntries);
      for (const { id, coords, infraBefore } of pendingLineMoves) {
        const roundedCoords = constrainGroupMovedLine(
          infraBefore,
          coords,
          movedPositions,
          currentInfra,
        );
        const payload = {
          lon: roundedCoords[0]![0],
          lat: roundedCoords[0]![1],
          end_lon: roundedCoords[roundedCoords.length - 1]![0],
          end_lat: roundedCoords[roundedCoords.length - 1]![1],
          coordinates: roundedCoords,
        };
        infraEntries.push({ objectId: id, before: infraGeometryUndo(infraBefore) });
        lineSaves.push({ id, payload, before: infraBefore });
      }

      const linkedLinePatches = lineEndpointPatchesToResults(
        accumulateLineEndpointPatches(currentInfra, movedPointUpdates, movedLineIds),
      );
      for (const patch of linkedLinePatches) {
        infraEntries.push({ objectId: patch.lineId, before: patch.before });
        lineSaves.push({
          id: patch.lineId,
          payload: patch.payload,
          before:
            currentInfra.find((o) => o.id === patch.lineId) ??
            ({
              ...patch.before,
              id: patch.lineId,
            } as InfraObject),
        });
      }

      setGeometrySavePending((p) => p + 1);
      try {
        if (poiSaves.length > 0) {
          queryClient.setQueriesData<POI[]>({ queryKey: ['pois', projectId] }, (old) =>
            old?.map((p) => {
              const save = poiSaves.find((s) => s.id === p.id);
              return save ? { ...p, lon: save.lon, lat: save.lat } : p;
            }) ?? [],
          );
          for (const save of poiSaves) {
            await poiApi.updatePoi(projectId, save.id, { lon: save.lon, lat: save.lat });
          }
        }

        if (pointSaves.length > 0 || lineSaves.length > 0) {
          const touchedIds = new Set([
            ...pointSaves.map((s) => s.id),
            ...lineSaves.map((s) => s.id),
          ]);
          patchInfraObjectsInQueries(queryClient, projectId, (o) => {
            const pointSave = pointSaves.find((s) => s.id === o.id);
            if (pointSave) return { ...o, lon: pointSave.lon, lat: pointSave.lat };
            const lineSave = lineSaves.find((s) => s.id === o.id);
            return lineSave ? { ...o, ...lineSave.payload } : o;
          });
          touchInfraOverlay(touchedIds);
          for (const save of pointSaves) {
            await mapApi.updateInfraObject(projectId, save.id, { lon: save.lon, lat: save.lat });
          }
          for (const save of lineSaves) {
            await mapApi.updateInfraObject(projectId, save.id, save.payload);
          }
        }

        const total = poiEntries.length + infraEntries.length;
        if (total > 0) {
          pushUndo({
            kind: 'patch_geometry_group',
            poiEntries,
            infraEntries,
            label: `перемещение ${items.length} объектов`,
          });
        }
      } catch (e) {
        pushToast('error', e instanceof Error ? e.message : 'Не удалось сохранить геометрию');
        invalidateMap();
      } finally {
        setGeometrySavePending((p) => Math.max(0, p - 1));
      }
    },
    [
      projectId,
      queryClient,
      pois,
      infraObjects,
      pushUndo,
      pushToast,
      invalidateMap,
      touchInfraOverlay,
      mapApi,
      poiApi,
    ],
  );

  return {
    geometrySavePending,
    setGeometrySavePending,
    handleGeometryChange,
    handleBatchGeometryChange,
  };
}
