import type { InfraLayer, InfraObject, Map3dCustomModel, POI } from '../../lib/api';
import type { PointFootprintLineConnections } from '../../lib/padFootprintLineAttach';
import type { FootprintLineConnectPickSubtype } from './PointFootprintLineConnectionsSection';

export type SelectedFeature =
  | { kind: 'poi'; poi: POI }
  | { kind: 'infra'; object: InfraObject };

export interface ObjectDetailPanelProps {
  selection: SelectedFeature;
  layers: InfraLayer[];
  map3dCustomModels?: Map3dCustomModel[];
  infraObjects?: InfraObject[];
  mapInFootprints?: boolean;
  footprintLineConnectPickSubtype?: FootprintLineConnectPickSubtype;
  onFootprintLineConnectPickSubtypeChange?: (lineSubtype: FootprintLineConnectPickSubtype) => void;
  /** Immediate PATCH of footprint_line_connections (map + panel picker). */
  onFootprintLineConnectionsPersist?: (
    pointId: string,
    connections: PointFootprintLineConnections,
  ) => void | Promise<void>;
  onSave: (data: Record<string, unknown>) => void;
  onDelete: () => void;
  onClose: () => void;
  onCopy?: () => void;
  onCut?: () => void;
  saving?: boolean;
  readOnly?: boolean;
  deleteDisabled?: boolean;
}
