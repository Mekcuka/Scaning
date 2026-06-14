import { useQueryClient } from '@tanstack/react-query';

import { useBottomholeDraw } from '../useBottomholeDraw';

import { useAppStore } from '../../store';

import type { MapPageActionsParams } from './mapPageActionsTypes';



export function useMapPageBottomholeDraw(

  params: MapPageActionsParams,

  draw: {
    placeBottomholeAt: ReturnType<
      typeof import('./actions/useMapDrawAndCreateActions').useMapDrawAndCreateActions
    >['placeBottomholeAt'];
    placeGsBottomholeAt: ReturnType<
      typeof import('./actions/useMapDrawAndCreateActions').useMapDrawAndCreateActions
    >['placeGsBottomholeAt'];
    nextAutoName: (subtype: string) => string;
  },

) {

  const { projectId, canWriteInfra, edit, data } = params;

  const queryClient = useQueryClient();

  const pushToast = useAppStore((s) => s.pushToast);



  return useBottomholeDraw({

    projectId,

    drawMode: edit.drawMode,

    infraObjects: data.infraObjects,

    canWriteInfra,

    nextAutoName: draw.nextAutoName ?? data.nextAutoName,

    placeBottomholeAt: draw.placeBottomholeAt,
    placeGsBottomholeAt: draw.placeGsBottomholeAt,
    pushToast,
    onCreated: () => {
      void queryClient.invalidateQueries({ queryKey: ['wellTrajectoryProjectGeoJson', projectId] });
      if (edit.drawMode === 'bottomhole_nnb' || edit.drawMode === 'bottomhole_gs') {
        edit.setDrawMode('select');
      }
    },

  });

}

