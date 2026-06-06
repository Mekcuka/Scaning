import { memo, useMemo } from 'react';
import { BaseEdge, useInternalNode, type EdgeProps } from '@xyflow/react';
import {
  computeSandEdgePath,
  edgePathInputFromEdgeProps,
  floatingSandSiteLinkEndpoints,
  type SandFlowNodeBox,
} from '../../../lib/sandLogisticsFlow';
import { useSandLineStyle } from './context';

function useFloatingSiteLinkPath(props: EdgeProps): string {
  const lineStyle = useSandLineStyle();
  const sourceNode = useInternalNode(props.source);
  const targetNode = useInternalNode(props.target);

  return useMemo(() => {
    if (sourceNode && targetNode) {
      const endpoints = floatingSandSiteLinkEndpoints(
        sourceNode as SandFlowNodeBox,
        targetNode as SandFlowNodeBox,
      );
      return computeSandEdgePath(lineStyle, endpoints)[0];
    }
    return computeSandEdgePath(lineStyle, edgePathInputFromEdgeProps(props))[0];
  }, [lineStyle, props, sourceNode, targetNode]);
}

export const FloatingSandSiteLinkEdge = memo(function FloatingSandSiteLinkEdge(
  props: EdgeProps,
) {
  const edgePath = useFloatingSiteLinkPath(props);
  return <BaseEdge id={props.id} path={edgePath} style={props.style} />;
});

export const FloatingSandPlannedSiteLinkEdge = memo(function FloatingSandPlannedSiteLinkEdge(
  props: EdgeProps,
) {
  const edgePath = useFloatingSiteLinkPath(props);
  return (
    <BaseEdge
      id={props.id}
      path={edgePath}
      style={{
        stroke: '#94a3b8',
        strokeWidth: 1.5,
        strokeDasharray: '4 3',
        ...props.style,
      }}
    />
  );
});
