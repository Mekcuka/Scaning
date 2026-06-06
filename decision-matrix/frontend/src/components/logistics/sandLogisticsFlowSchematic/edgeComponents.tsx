import { memo } from 'react';
import { BaseEdge, MarkerType, type Edge, type EdgeProps } from '@xyflow/react';
import {
  computeSandEdgePath,
  edgePathInputFromEdgeProps,
  polylineToSvgPath,
  type SandRoadEdgeData,
  type SandRoadPolylineEdgeData,
} from '../../../lib/sandLogisticsFlow';
import { useSandEdgeLabelMode, useSandLineStyle } from './context';
import { FloatingSandPlannedSiteLinkEdge, FloatingSandSiteLinkEdge } from './floatingSiteLinkEdge';
import { SandFlowEdgeVolumeLabel } from './edgeLabelSvg';

const SandRoadEdge = memo(function SandRoadEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps<Edge<SandRoadEdgeData>>) {
  const lineStyle = useSandLineStyle();
  const edgeLabelMode = useSandEdgeLabelMode();
  const flowM3 = data?.flowM3 ?? 0;
  const hasFlow = flowM3 > 0;
  const showSegmentLabel =
    edgeLabelMode !== 'hidden' && hasFlow && data?.showFlowLabel !== false;
  const [edgePath, labelX, labelY] = computeSandEdgePath(lineStyle, {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const stroke = (style?.stroke as string) ?? (hasFlow ? '#b45309' : '#cbd5e1');
  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={style}
        markerEnd={
          hasFlow
            ? ((markerEnd ?? {
                type: MarkerType.ArrowClosed,
                color: stroke,
              }) as EdgeProps['markerEnd'])
            : undefined
        }
      />
      {showSegmentLabel && (
        <SandFlowEdgeVolumeLabel lx={labelX} ly={labelY} flowM3={flowM3} stroke={stroke} />
      )}
    </>
  );
});

const SandRoadPolylineEdge = memo(function SandRoadPolylineEdge({
  id,
  style,
  markerEnd,
  data,
}: EdgeProps<Edge<SandRoadPolylineEdgeData>>) {
  const lineStyle = useSandLineStyle();
  const edgeLabelMode = useSandEdgeLabelMode();
  const points = data?.points ?? [];
  const flowM3 = data?.flowM3 ?? 0;
  const hasFlow = flowM3 > 0;
  const showSegmentLabel =
    edgeLabelMode !== 'hidden' && hasFlow && data?.showFlowLabel !== false;
  const [edgePath, labelX, labelY] = polylineToSvgPath(lineStyle, points);
  if (!edgePath) return null;
  const stroke = (style?.stroke as string) ?? (hasFlow ? '#b45309' : '#cbd5e1');
  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={style}
        markerEnd={
          hasFlow
            ? ((markerEnd ?? {
                type: MarkerType.ArrowClosed,
                color: stroke,
              }) as EdgeProps['markerEnd'])
            : undefined
        }
      />
      {showSegmentLabel && (
        <SandFlowEdgeVolumeLabel lx={labelX} ly={labelY} flowM3={flowM3} stroke={stroke} />
      )}
    </>
  );
});

const SandPlannedRoadPolylineEdge = memo(function SandPlannedRoadPolylineEdge({
  id,
  style,
  data,
}: EdgeProps<Edge<SandRoadPolylineEdgeData>>) {
  const lineStyle = useSandLineStyle();
  const [edgePath] = polylineToSvgPath(lineStyle, data?.points ?? []);
  if (!edgePath) return null;
  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: '#64748b',
        strokeWidth: 2,
        strokeDasharray: '6 4',
        ...style,
      }}
    />
  );
});

const SandPlannedRoadEdge = memo(function SandPlannedRoadEdge(props: EdgeProps) {
  const lineStyle = useSandLineStyle();
  const [edgePath] = computeSandEdgePath(lineStyle, edgePathInputFromEdgeProps(props));
  return (
    <BaseEdge
      id={props.id}
      path={edgePath}
      style={{
        stroke: '#64748b',
        strokeWidth: 2,
        strokeDasharray: '6 4',
        ...props.style,
      }}
    />
  );
});

const SandSiteLinkEdge = FloatingSandSiteLinkEdge;
const SandPlannedSiteLinkEdge = FloatingSandPlannedSiteLinkEdge;

export const edgeTypes = {
  sandRoadEdge: SandRoadEdge,
  sandRoadPolylineEdge: SandRoadPolylineEdge,
  sandSiteLinkEdge: SandSiteLinkEdge,
  sandPlannedRoadEdge: SandPlannedRoadEdge,
  sandPlannedRoadPolylineEdge: SandPlannedRoadPolylineEdge,
  sandPlannedSiteLinkEdge: SandPlannedSiteLinkEdge,
};
