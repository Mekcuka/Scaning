import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { FootprintLineConnectPickSubtype } from '../components/objectDetailPanel/PointFootprintLineConnectionsSection';
import type { SelectedFeature } from '../components/objectDetailPanel/types';
import { isLineSubtype } from '../lib/infraGeometry';
import { isEarthworkEligibleSubtype } from '../lib/infraPadEarthwork';
import {
  mergePointFootprintLineConnection,
  nearestFootprintEdgeForObject,
  readPointFootprintLineConnections,
  writePointFootprintLineConnections,
  type PointFootprintLineConnections,
} from '../lib/padFootprintLineAttach';
import {
  defaultMapMutationsApi,
  type InfraObject,
  type MapMutationsApiPort,
} from '../lib/api';
import { patchInfraObjectsInQueries } from '../lib/mapQueries';
import { infraDetailUndo, type MapUndoEntry } from '../lib/mapUndo';

export type FootprintEdgeHighlight = {
  pointId: string;
  edgeIndex: number;
} | null;

export function useLineFootprintEdgePick(params: {
  projectId: string | undefined;
  mapInFootprints: boolean;
  canWriteInfra: boolean;
  detailSelection: SelectedFeature | null;
  infraObjects: InfraObject[];
  footprintLineConnectPickSubtype: FootprintLineConnectPickSubtype;
  setFootprintLineConnectPickSubtype: (lineSubtype: FootprintLineConnectPickSubtype) => void;
  pushUndo: (entry: MapUndoEntry) => void;
  pushToast: (kind: 'success' | 'error' | 'info', message: string) => void;
  mapApi?: MapMutationsApiPort;
}) {
  const {
    projectId,
    mapInFootprints,
    canWriteInfra,
    detailSelection,
    infraObjects,
    footprintLineConnectPickSubtype,
    setFootprintLineConnectPickSubtype,
    pushUndo,
    pushToast,
    mapApi = defaultMapMutationsApi,
  } = params;
  const queryClient = useQueryClient();
  const [footprintEdgeHighlight, setFootprintEdgeHighlight] =
    useState<FootprintEdgeHighlight>(null);

  const activePoint =
    detailSelection?.kind === 'infra' &&
    !isLineSubtype(detailSelection.object.subtype) &&
    isEarthworkEligibleSubtype(detailSelection.object.subtype)
      ? detailSelection.object
      : null;

  const handlePointerMoveForEdgePick = useCallback(
    (lon: number, lat: number) => {
      if (!mapInFootprints || !footprintLineConnectPickSubtype || !activePoint) {
        setFootprintEdgeHighlight(null);
        return;
      }
      const hit = nearestFootprintEdgeForObject(activePoint, [lon, lat]);
      if (!hit) {
        setFootprintEdgeHighlight(null);
        return;
      }
      setFootprintEdgeHighlight({ pointId: activePoint.id, edgeIndex: hit.edgeIndex });
    },
    [mapInFootprints, footprintLineConnectPickSubtype, activePoint],
  );

  const savePointFootprintLineConnections = useCallback(
    async (pointId: string, connections: PointFootprintLineConnections) => {
      if (!projectId || !canWriteInfra) return;
      const beforeObj = infraObjects.find((o) => o.id === pointId);
      if (!beforeObj) return;
      const before = infraDetailUndo(beforeObj);
      const props = writePointFootprintLineConnections(
        { ...(beforeObj.properties ?? {}) },
        Object.keys(connections).length ? connections : null,
      );
      patchInfraObjectsInQueries(queryClient, projectId, (o) =>
        o.id === pointId ? { ...o, properties: props } : o,
      );
      try {
        await mapApi.updateInfraObject(projectId, pointId, { properties: props });
        pushUndo({
          kind: 'patch_infra_detail',
          objectId: pointId,
          before,
          label: `точки подключения «${beforeObj.name}»`,
        });
      } catch (e) {
        patchInfraObjectsInQueries(queryClient, projectId, (o) =>
          o.id === pointId ? beforeObj : o,
        );
        pushToast('error', e instanceof Error ? e.message : 'Не удалось сохранить точки подключения');
      }
    },
    [projectId, canWriteInfra, infraObjects, queryClient, mapApi, pushUndo, pushToast],
  );

  const handleMapClickForEdgePick = useCallback(
    async (lon: number, lat: number): Promise<boolean> => {
      if (
        !mapInFootprints ||
        !footprintLineConnectPickSubtype ||
        !activePoint ||
        !canWriteInfra ||
        !projectId
      ) {
        return false;
      }
      const hit = nearestFootprintEdgeForObject(activePoint, [lon, lat]);
      if (!hit) return false;

      const nextProps = mergePointFootprintLineConnection(
        activePoint.properties ?? {},
        footprintLineConnectPickSubtype,
        { edge_index: hit.edgeIndex, t: hit.t },
      );
      const nextConnections = readPointFootprintLineConnections(nextProps);
      await savePointFootprintLineConnections(activePoint.id, nextConnections);
      setFootprintLineConnectPickSubtype(null);
      setFootprintEdgeHighlight(null);
      pushToast('success', 'Точка подключения на контуре выбрана');
      return true;
    },
    [
      mapInFootprints,
      footprintLineConnectPickSubtype,
      activePoint,
      canWriteInfra,
      projectId,
      savePointFootprintLineConnections,
      setFootprintLineConnectPickSubtype,
      pushToast,
    ],
  );

  const handlePointFootprintLineConnectionsChange = useCallback(
    async (pointId: string, connections: PointFootprintLineConnections) => {
      await savePointFootprintLineConnections(pointId, connections);
    },
    [savePointFootprintLineConnections],
  );

  return {
    footprintEdgeHighlight,
    handlePointerMoveForEdgePick,
    handleMapClickForEdgePick,
    handlePointFootprintLineConnectionsChange,
    clearFootprintEdgeHighlight: () => setFootprintEdgeHighlight(null),
  };
}
