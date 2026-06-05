import type { InfraLayer, InfraObject, Map3dCustomModel, POI } from '../../lib/api';

export type SelectedFeature =
  | { kind: 'poi'; poi: POI }
  | { kind: 'infra'; object: InfraObject };

export interface ObjectDetailPanelProps {
  selection: SelectedFeature;
  layers: InfraLayer[];
  map3dCustomModels?: Map3dCustomModel[];
  onSave: (data: Record<string, unknown>) => void;
  onDelete: () => void;
  onClose: () => void;
  onCopy?: () => void;
  onCut?: () => void;
  saving?: boolean;
  readOnly?: boolean;
  deleteDisabled?: boolean;
}
