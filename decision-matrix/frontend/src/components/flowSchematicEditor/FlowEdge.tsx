import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import { formatCapacity, formatEdgeFlow } from '../../lib/flowSchematic';
import { useFlowEdgePropagation } from '../../lib/flowSchematicContext';

export function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
}: EdgeProps) {
  const edgeFlowMap = useFlowEdgePropagation();
  const fs = edgeFlowMap.get(id);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const showLabel = fs?.flowAnnual != null && fs.flowAnnual > 0;

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            className="flow-edge-label nodrag nopan"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              borderColor: (style?.stroke as string) ?? 'var(--border)',
              color: (style?.stroke as string) ?? 'var(--text)',
            }}
            title={formatCapacity(fs.flowAnnual, fs.flowUnit)}
          >
            {formatEdgeFlow(fs.flowAnnual!, fs.flowUnit)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
