import { AutoroadNetworkPanel } from '../../components/AutoroadNetworkPanel';
import { PadPlacementPanel } from '../../components/mapView/PadPlacementPanel';
import type { AutoroadSubtypeBulkOption } from '../../components/AutoroadNetworkPanel';
import { MapGroupSelectionPanel } from '../../components/MapGroupSelectionPanel';
import type { MapGroupSelectionItem } from '../../components/MapGroupSelectionPanel';
import { ObjectDetailPanel } from '../../components/ObjectDetailPanel';
import type { SelectedFeature } from '../../components/ObjectDetailPanel';
import type { DrawMode, SelectMode } from '../../components/MapView';
import type { AutoroadNetworkPickMode } from '../../lib/autoroadNetwork';
import type { AutoroadPlannerOptions } from '../../lib/autoroadNetworkPlannerOptions';
import type { SolverStatus } from '../../components/AutoroadNetworkParamsSection';
import type {
  PadPlacementComputeResponse,
  PadPlacementParams,
} from '../../lib/padPlacementTypes';
import type { InfraLayer, Map3dCustomModel, InfraObject } from '../../lib/api';

export type MapPageSidePanelsProps = {
  drawMode: DrawMode;
  selectMode: SelectMode;
  detailSelection: SelectedFeature | null;
  layers: InfraLayer[];
  map3dCustomModels: Map3dCustomModel[];
  infraObjects: InfraObject[];
  mapInFootprints: boolean;
  footprintLineConnectPickSubtype: string | null;
  onFootprintLineConnectPickSubtypeChange: (lineSubtype: string | null) => void;
  onFootprintLineConnectionsPersist?: (
    pointId: string,
    connections: import('../../lib/padFootprintLineAttach').PointFootprintLineConnections,
  ) => void | Promise<void>;
  saveDetailPending: boolean;
  canWriteProject: boolean;
  canWriteInfra: boolean;
  onCloseDetail: () => void;
  onSaveDetail: (data: Record<string, unknown>) => void;
  onDeleteDetail: () => void;
  onCopyDetail?: () => void;
  onCutDetail?: () => void;
  autoroadNetworkDetails: MapGroupSelectionItem[];
  autoroadNetworkPickMode: AutoroadNetworkPickMode;
  onAutoroadPickModeChange: (mode: AutoroadNetworkPickMode) => void;
  onCloseAutoroad: () => void;
  onClearAutoroadTerminals: () => void;
  onRemoveAutoroadItem: (id: string) => void;
  onAddVisibleAutoroadTerminals: () => void;
  onAddAutoroadTerminalsBySubtype: (subtype: string) => void;
  visibleEligibleAutoroadCount: number;
  autoroadSubtypeBulkOptions: AutoroadSubtypeBulkOption[];
  onAutoroadPreview: () => void;
  canAutoroadNetworkPreview: boolean;
  autoroadNetworkDisabledHint: string | null | undefined;
  autoroadNetworkPending: boolean;
  autoroadPlannerOptions: AutoroadPlannerOptions;
  onAutoroadPlannerOptionsChange: (next: AutoroadPlannerOptions) => void;
  solverStatus: SolverStatus | null;
  solverStatusLoading: boolean;
  groupSelectionDetails: MapGroupSelectionItem[];
  onClearGroupSelection: () => void;
  onCopyGroup: () => void;
  onCutGroup: () => void;
  onPasteGroup: () => void;
  onDeleteGroup: () => void;
  canCopyMapSelection: boolean;
  canCutMapSelection: boolean;
  canPasteMapClipboard: boolean;
  canDeleteCurrentSelection: boolean;
  deleteGroupPending: boolean;
  padPlacementDetails: MapGroupSelectionItem[];
  padPlacementVisibleEligibleCount: number;
  padPlacementParams: PadPlacementParams;
  setPadPlacementParams: (next: PadPlacementParams) => void;
  padPlacementSubtype: 'oil_pad' | 'gas_pad';
  setPadPlacementSubtype: (v: 'oil_pad' | 'gas_pad') => void;
  padPlacementComputeResult: PadPlacementComputeResponse | null;
  padPlacementSelectedVariant: number | null;
  setPadPlacementSelectedVariant: (index: number) => void;
  onPadPlacementCompute: () => void;
  onPadPlacementApply: () => void;
  padPlacementComputePending: boolean;
  padPlacementApplyPending: boolean;
  canPadPlacementCompute: boolean;
  padPlacementDisabledHint: string | null | undefined;
  onClearPadPlacementBottomholes: () => void;
  onRemovePadPlacementItem: (id: string) => void;
  onAddVisiblePadPlacementBottomholes: () => void;
};

export function MapPageSidePanels({
  drawMode,
  selectMode,
  detailSelection,
  layers,
  map3dCustomModels,
  infraObjects,
  mapInFootprints,
  footprintLineConnectPickSubtype,
  onFootprintLineConnectPickSubtypeChange,
  onFootprintLineConnectionsPersist,
  saveDetailPending,
  canWriteProject,
  canWriteInfra,
  onCloseDetail,
  onSaveDetail,
  onDeleteDetail,
  onCopyDetail,
  onCutDetail,
  autoroadNetworkDetails,
  autoroadNetworkPickMode,
  onAutoroadPickModeChange,
  onCloseAutoroad,
  onClearAutoroadTerminals,
  onRemoveAutoroadItem,
  onAddVisibleAutoroadTerminals,
  onAddAutoroadTerminalsBySubtype,
  visibleEligibleAutoroadCount,
  autoroadSubtypeBulkOptions,
  onAutoroadPreview,
  canAutoroadNetworkPreview,
  autoroadNetworkDisabledHint,
  autoroadNetworkPending,
  autoroadPlannerOptions,
  onAutoroadPlannerOptionsChange,
  solverStatus,
  solverStatusLoading,
  groupSelectionDetails,
  onClearGroupSelection,
  onCopyGroup,
  onCutGroup,
  onPasteGroup,
  onDeleteGroup,
  canCopyMapSelection,
  canCutMapSelection,
  canPasteMapClipboard,
  canDeleteCurrentSelection,
  deleteGroupPending,
  padPlacementDetails,
  padPlacementVisibleEligibleCount,
  padPlacementParams,
  setPadPlacementParams,
  padPlacementSubtype,
  setPadPlacementSubtype,
  padPlacementComputeResult,
  padPlacementSelectedVariant,
  setPadPlacementSelectedVariant,
  onPadPlacementCompute,
  onPadPlacementApply,
  padPlacementComputePending,
  padPlacementApplyPending,
  canPadPlacementCompute,
  padPlacementDisabledHint,
  onClearPadPlacementBottomholes,
  onRemovePadPlacementItem,
  onAddVisiblePadPlacementBottomholes,
}: MapPageSidePanelsProps) {
  return (
    <>
      {detailSelection && drawMode === 'select' && selectMode === 'single' && (
        <ObjectDetailPanel
          selection={detailSelection}
          layers={layers}
          map3dCustomModels={map3dCustomModels}
          infraObjects={infraObjects}
          mapInFootprints={mapInFootprints}
          footprintLineConnectPickSubtype={footprintLineConnectPickSubtype}
          onFootprintLineConnectPickSubtypeChange={onFootprintLineConnectPickSubtypeChange}
          onFootprintLineConnectionsPersist={onFootprintLineConnectionsPersist}
          saving={saveDetailPending}
          readOnly={detailSelection.kind === 'poi' ? !canWriteProject : !canWriteInfra}
          onClose={onCloseDetail}
          onSave={onSaveDetail}
          onDelete={onDeleteDetail}
          onCopy={onCopyDetail}
          onCut={onCutDetail}
        />
      )}

      {drawMode === 'autoroad_network' && (
        <AutoroadNetworkPanel
          items={autoroadNetworkDetails}
          pickMode={autoroadNetworkPickMode}
          onPickModeChange={onAutoroadPickModeChange}
          onClose={onCloseAutoroad}
          onClear={onClearAutoroadTerminals}
          onRemoveItem={onRemoveAutoroadItem}
          onAddVisible={onAddVisibleAutoroadTerminals}
          onAddBySubtype={onAddAutoroadTerminalsBySubtype}
          visibleEligibleCount={visibleEligibleAutoroadCount}
          subtypeBulkOptions={autoroadSubtypeBulkOptions}
          onPreview={onAutoroadPreview}
          canPreview={canAutoroadNetworkPreview}
          disabledHint={autoroadNetworkDisabledHint}
          pending={autoroadNetworkPending}
          plannerOptions={autoroadPlannerOptions}
          onPlannerOptionsChange={onAutoroadPlannerOptionsChange}
          solverStatus={solverStatus}
          solverStatusLoading={solverStatusLoading}
        />
      )}

      {drawMode === 'pad_placement' && (
        <PadPlacementPanel
          items={padPlacementDetails}
          visibleEligibleCount={padPlacementVisibleEligibleCount}
          params={padPlacementParams}
          onParamsChange={setPadPlacementParams}
          subtype={padPlacementSubtype}
          onSubtypeChange={setPadPlacementSubtype}
          computeResult={padPlacementComputeResult}
          selectedVariantIndex={padPlacementSelectedVariant}
          onSelectVariant={setPadPlacementSelectedVariant}
          onClose={onCloseAutoroad}
          onClear={onClearPadPlacementBottomholes}
          onRemoveItem={onRemovePadPlacementItem}
          onAddVisible={onAddVisiblePadPlacementBottomholes}
          onCompute={onPadPlacementCompute}
          onApply={onPadPlacementApply}
          canCompute={canPadPlacementCompute}
          disabledHint={padPlacementDisabledHint}
          computePending={padPlacementComputePending}
          applyPending={padPlacementApplyPending}
        />
      )}

      {drawMode === 'select' && selectMode === 'box' && groupSelectionDetails.length > 0 && (
        <MapGroupSelectionPanel
          items={groupSelectionDetails}
          onClear={onClearGroupSelection}
          onCopy={onCopyGroup}
          onCut={onCutGroup}
          onPaste={onPasteGroup}
          onDelete={onDeleteGroup}
          canCopy={canCopyMapSelection}
          canCut={canCutMapSelection}
          canPaste={canPasteMapClipboard}
          canDelete={canDeleteCurrentSelection}
          deletePending={deleteGroupPending}
        />
      )}
    </>
  );
}
