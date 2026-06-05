import { memo } from 'react';
import { BaseEdge, MarkerType, type Edge, type EdgeProps } from '@xyflow/react';
import {
  computeSandEdgePath,
  formatSandEdgeM3,
  polylineToSvgPath,
  type SandRoadEdgeData,
  type SandRoadPolylineEdgeData,
} from '../../../lib/sandLogisticsFlow';
import { useSandEdgeLabelMode, useSandLineStyle } from './context';
import { SandFlowEdgeSegmentLabel } from './edgeLabelSvg';

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
  const showSegmentLabel = edgeLabelMode === 'all' && hasFlow;
  const [edgePath, labelX, labelY] = computeSandEdgePath(lineStyle, {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const offsetX = data?.labelOffsetX ?? 0;
  const offsetY = data?.labelOffsetY ?? 0;
  const lx = labelX + offsetX;
  const ly = labelY + offsetY;

  const stroke = (style?.stroke as string) ?? (hasFlow ? '#b45309' : '#cbd5e1');
  const label = showSegmentLabel ? formatSandEdgeM3(flowM3) : '';

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
        <SandFlowEdgeSegmentLabel lx={lx} ly={ly} label={label} stroke={stroke} />
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
  const showSegmentLabel = edgeLabelMode === 'all' && hasFlow;
  const [edgePath, labelX, labelY] = polylineToSvgPath(lineStyle, points);
  if (!edgePath) return null;
  const offsetX = data?.labelOffsetX ?? 0;
  const offsetY = data?.labelOffsetY ?? 0;
  const lx = labelX + offsetX;
  const ly = labelY + offsetY;
  const stroke = (style?.stroke as string) ?? (hasFlow ? '#b45309' : '#cbd5e1');
  const label = showSegmentLabel ? formatSandEdgeM3(flowM3) : '';

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
        <SandFlowEdgeSegmentLabel lx={lx} ly={ly} label={label} stroke={stroke} />
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

const SandSiteLinkEdge = memo(function SandSiteLinkEdge(props: EdgeProps) {
  const lineStyle = useSandLineStyle();
  const [edgePath] = computeSandEdgePath(lineStyle, props);
  return <BaseEdge id={props.id} path={edgePath} style={props.style} />;
});

const SandPlannedRoadEdge = memo(function SandPlannedRoadEdge(props: EdgeProps) {
  const lineStyle = useSandLineStyle();
  const [edgePath] = computeSandEdgePath(lineStyle, props);
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

const SandPlannedSiteLinkEdge = memo(function SandPlannedSiteLinkEdge(props: EdgeProps) {
  const lineStyle = useSandLineStyle();
  const [edgePath] = computeSandEdgePath(lineStyle, props);
  return <BaseEdge id={props.id} path={edgePath} style={props.style} />;
});

export const edgeTypes = {
  sandRoadEdge: SandRoadEdge,
  sandRoadPolylineEdge: SandRoadPolylineEdge,
  sandSiteLinkEdge: SandSiteLinkEdge,
  sandPlannedRoadEdge: SandPlannedRoadEdge,
  sandPlannedRoadPolylineEdge: SandPlannedRoadPolylineEdge,
  sandPlannedSiteLinkEdge: SandPlannedSiteLinkEdge,
};
