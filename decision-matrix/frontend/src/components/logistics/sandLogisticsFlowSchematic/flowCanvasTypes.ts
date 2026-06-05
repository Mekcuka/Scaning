import type { Edge, Node } from '@xyflow/react';
import type {
  SandFlowNodeData,
  SandLegLabelNodeData,
  SandLogisticsEdgeLabelMode,
  SandLogisticsLineStyle,
  SandLogisticsNodeFilterMode,
  SandPlannedLegLabelNodeData,
} from '../../../lib/sandLogisticsFlow';

export type FlowCanvasProps = {
  initialNodes: Node<SandFlowNodeData | SandLegLabelNodeData | SandPlannedLegLabelNodeData>[];
  initialEdges: Edge[];
  siteNodeIds: string[];
  defaultViewport: { x: number; y: number; zoom: number };
  isMobile: boolean;
  lineStyle: SandLogisticsLineStyle;
  edgeLabelMode: SandLogisticsEdgeLabelMode;
  nodeFilter: SandLogisticsNodeFilterMode;
  showPlannedRoutes: boolean;
  groupByEntryYear: boolean;
  onLineStyleChange: (style: SandLogisticsLineStyle) => void;
  onEdgeLabelModeChange: (mode: SandLogisticsEdgeLabelMode) => void;
  onNodeFilterChange: (mode: SandLogisticsNodeFilterMode) => void;
  onShowPlannedRoutesChange: (value: boolean) => void;
  onGroupByEntryYearChange: (value: boolean) => void;
};
