import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SelectedFeature } from '../components/ObjectDetailPanel';
import {
  defaultMapMutationsApi,
  defaultProjectsPoiWriteApi,
  type InfraObject,
  type MapMutationsApiPort,
  type POI,
  type ProjectsPoiWriteApiPort,
} from '../lib/api';
import { upsertInfraObjectInQueries, patchInfraObjectsInQueries } from '../lib/mapQueries';
import {
  infraDetailUndo,
  poiDetailUndo,
  type MapUndoEntry,
} from '../lib/mapUndo';

export type UseMapDetailSaveParams = {
  projectId: string | undefined;
  detailSelection: SelectedFeature | null;
  pushUndo: (entry: MapUndoEntry) => void;
  pushToast: (kind: 'success' | 'error' | 'info', message: string) => void;
  mapApi?: MapMutationsApiPort;
  poiApi?: ProjectsPoiWriteApiPort;
};

export function useMapDetailSave({
  projectId,
  detailSelection,
  pushUndo,
  pushToast,
  mapApi = defaultMapMutationsApi,
  poiApi = defaultProjectsPoiWriteApi,
}: UseMapDetailSaveParams) {
  const queryClient = useQueryClient();

  const saveDetailMut = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (!detailSelection) return;
      if (detailSelection.kind === 'poi') {
        return poiApi.updatePoi(projectId!, detailSelection.poi.id, data as Partial<POI> & {
          lon?: number;
          lat?: number;
        });
      }
      return mapApi.updateInfraObject(projectId!, detailSelection.object.id, {
        name: data.name as string,
        description: data.description as string,
        subtype: data.subtype as string,
        layer_id: data.layer_id as string,
        lon: data.lon as number,
        lat: data.lat as number,
        ...(Array.isArray(data.coordinates)
          ? {
              coordinates: data.coordinates as number[][],
              end_lon: data.end_lon as number,
              end_lat: data.end_lat as number,
            }
          : {}),
        ...(data.properties ? { properties: data.properties as Record<string, unknown> } : {}),
      });
    },
    onMutate: (data) => {
      if (!detailSelection) return;
      if (detailSelection.kind === 'poi') {
        return {
          undo: {
            kind: 'patch_poi_detail' as const,
            poiId: detailSelection.poi.id,
            before: poiDetailUndo(detailSelection.poi),
            label: `изменение «${detailSelection.poi.name}»`,
          },
        };
      }
      if (projectId) {
        patchInfraObjectsInQueries(queryClient, projectId, (o) => {
          if (o.id !== detailSelection.object.id) return o;
          return {
            ...o,
            ...(typeof data.name === 'string' ? { name: data.name } : {}),
            ...(typeof data.lon === 'number' ? { lon: data.lon } : {}),
            ...(typeof data.lat === 'number' ? { lat: data.lat } : {}),
            ...(typeof data.end_lon === 'number' ? { end_lon: data.end_lon } : {}),
            ...(typeof data.end_lat === 'number' ? { end_lat: data.end_lat } : {}),
            ...(Array.isArray(data.coordinates)
              ? { coordinates: data.coordinates as number[][] }
              : {}),
            ...(data.properties && typeof data.properties === 'object'
              ? { properties: { ...(o.properties ?? {}), ...(data.properties as Record<string, unknown>) } }
              : {}),
          };
        });
      }
      return {
        undo: {
          kind: 'patch_infra_detail' as const,
          objectId: detailSelection.object.id,
          before: infraDetailUndo(detailSelection.object),
          label: `изменение «${detailSelection.object.name}»`,
        },
      };
    },
    onSuccess: (updated, _vars, ctx) => {
      if (ctx?.undo) pushUndo(ctx.undo);
      if (!projectId || !updated || !detailSelection) return;
      if (detailSelection.kind === 'poi') {
        queryClient.setQueryData<POI[]>(['pois', projectId], (old) =>
          old?.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)) ?? [],
        );
        void queryClient.invalidateQueries({ queryKey: ['analysis', projectId] });
        void queryClient.invalidateQueries({
          queryKey: ['flow-schematic', projectId, updated.id],
        });
      } else {
        upsertInfraObjectInQueries(queryClient, projectId, updated as InfraObject);
      }
      const label =
        detailSelection.kind === 'poi'
          ? detailSelection.poi.name
          : detailSelection.object.name;
      pushToast('success', label ? `Сохранено: «${label}»` : 'Изменения сохранены');
    },
    onError: (err) => {
      pushToast('error', err instanceof Error ? err.message : 'Не удалось сохранить');
    },
  });

  return { saveDetailMut };
}
