import type { MapPageFooterProps } from '../../../pages/map/MapPageFooter';
import type { BuildMapPageSectionsParams } from './types';

export function buildFooterSection(
  params: Pick<
    BuildMapPageSectionsParams,
    'mapIn3d' | 'layerPrefs' | 'patchLayerPrefs' | 'shell' | 'edit' | 'actions'
  >,
): MapPageFooterProps {
  const { mapIn3d, layerPrefs, patchLayerPrefs, shell, edit, actions } = params;

  return {
    mapScaleLabel: shell.mapScaleLabel,
    geometrySavePending: actions.geometrySavePending,
    drawMode: edit.drawMode,
    mapIn3d,
    mapFooterHint: actions.mapFooterHint,
    rulerPointsLength: actions.rulerPoints.length,
    autoroadNetworkPending: actions.runAutoroadNetworkFlow.isPending,
    autoroadNetworkPickMode: actions.autoroadNetworkPickMode,
    lineDraftLength: actions.lineDraft.length,
    lineLodScaleThreshold: layerPrefs.lineLodScaleThreshold,
    mapScaleDenominator: shell.mapScaleDenominator,
    onLineLodChange: (threshold) => patchLayerPrefs({ lineLodScaleThreshold: threshold }),
  };
}
