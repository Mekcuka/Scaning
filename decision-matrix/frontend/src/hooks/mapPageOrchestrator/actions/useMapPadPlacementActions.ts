import { useMapPadPlacement } from '../../useMapPadPlacement';
import type { MapPageActionsParams } from '../mapPageActionsTypes';
import { useAppStore } from '../../../store';

export function useMapPadPlacementActions(params: MapPageActionsParams) {
  const { projectId, canWriteInfra, edit, data } = params;
  const pushToast = useAppStore((s) => s.pushToast);
  const { projectJobBusy, infraObjects, mapBbox, invalidateMap } = data;

  const padPlacement = useMapPadPlacement({
    projectId: projectId ?? undefined,
    drawMode: edit.drawMode,
    setDrawMode: edit.setDrawMode,
    infraObjects,
    mapBbox,
    canWriteInfra,
    projectJobBusy,
    pushToast,
    invalidateMap,
  });

  return {
    padPlacementBottomholeIds: padPlacement.bottomholeIds,
    setPadPlacementBottomholeIds: padPlacement.setBottomholeIds,
    padPlacementDetails: padPlacement.bottomholeDetails,
    padPlacementParams: padPlacement.params,
    setPadPlacementParams: padPlacement.setParams,
    padPlacementSubtype: padPlacement.subtype,
    setPadPlacementSubtype: padPlacement.setSubtype,
    padPlacementComputeResult: padPlacement.computeResult,
    padPlacementSelectedVariant: padPlacement.selectedVariantIndex,
    setPadPlacementSelectedVariant: padPlacement.setSelectedVariantIndex,
    padPlacementPreviewFeatures: padPlacement.previewFeatures,
    padPlacementComputeMut: padPlacement.computeMut,
    padPlacementApplyMut: padPlacement.applyMut,
    handlePadPlacementMapClick: padPlacement.handleMapClick,
    handlePadPlacementDragBoxPick: padPlacement.handleDragBoxPick,
    handleAddVisiblePadPlacementBottomholes: padPlacement.handleAddVisible,
    padPlacementVisibleEligibleCount: padPlacement.visibleEligibleCount,
    canPadPlacementCompute: padPlacement.canCompute,
    padPlacementDisabledHint: padPlacement.disabledHint,
  };
}
