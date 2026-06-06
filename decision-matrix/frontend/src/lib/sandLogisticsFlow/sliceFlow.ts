import type { Edge, Node } from '@xyflow/react';
import type { SandLogisticsSubnet } from '../api';
import { consumerId, networkNodeId, quarryId, segmentKey } from './ids';
import { shortestPath } from './roadGraph';
import {
  formatSandEdgeM3,
  haulLegPolylinePoints,
  polylineMidpoint,
  simplifyRoadNetworkPolylines,
} from './roadPolylines';
import { ensureSchematicEndpointNodes } from './schematicNodes';
import { addSiteSnapConnectors } from './schematicLinks';
import {
  collectAllocatedConsumerSnaps,
  createFlowLabelSlotTracker,
  shouldShowRoadPolylineFlowLabel,
  sortPolylinesForKeyFlowLabels,
} from './flowLabelPlacement';
import { shouldShowConsumerOnSchematic, shouldShowQuarryOnSchematic } from './sliceKeys';
import type {
  SandFlowNodeData,
  SandLegLabelNodeData,
  SandLogisticsFlowOptions,
  SandLogisticsFlowResult,
  SandLogisticsLayoutResult,
  SandPlannedLegLabelNodeData,
  SandRoadPolylineEdgeData,
} from './types';

export function buildSandLogisticsSliceFlow(
  layout: SandLogisticsLayoutResult,
  result: SandLogisticsSubnet,
  options?: SandLogisticsFlowOptions,
): SandLogisticsFlowResult {
  const edgeLabelMode = options?.edgeLabelMode ?? 'key';
  const nodeFilter = options?.nodeFilter ?? 'all_planned';
  const showPlannedRoutes = options?.showPlannedRoutes ?? true;
  const asOf = options?.as_of;
  const { positions, roadGraph, keyNetworkNodes, siteSpecs } = layout;

  const visibleQuarries = result.quarries.filter((q) => shouldShowQuarryOnSchematic(q, nodeFilter));
  const visibleConsumers = result.consumers.filter((c) =>
    shouldShowConsumerOnSchematic(c, nodeFilter),
  );

  const quarryById = new Map(visibleQuarries.map((q) => [q.object_id, q]));
  const quarryIds = new Set(visibleQuarries.map((q) => q.object_id));

  const nodes: Node<SandFlowNodeData | SandLegLabelNodeData | SandPlannedLegLabelNodeData>[] = [];
  const edges: Edge[] = [];

  for (const nodeId of keyNetworkNodes) {
    const id = networkNodeId(nodeId);
    const pos = positions.get(id);
    if (!pos) continue;
    nodes.push({
      id,
      type: 'sandNetworkNode',
      position: pos,
      zIndex: 1,
      selectable: false,
      draggable: false,
      className: 'nopan nodrag',
      data: { kind: 'network', label: '', hiddenAnchor: true },
    });
  }

  const segmentFlowM3 = new Map<string, number>();
  const plannedSegmentKeys = new Set<string>();
  const siteLinks = new Set<string>();
  const plannedSiteLinks = new Set<string>();
  const plannedLegLabelSpecs: { id: string; label: string; x: number; y: number }[] = [];

  let totalDemand = 0;
  let totalAllocated = 0;

  for (const q of visibleQuarries) {
    if (!q.snap_node_id) continue;
    const id = quarryId(q.object_id);
    nodes.push({
      id,
      type: 'sandFlowNode',
      position: positions.get(id) ?? { x: 0, y: 0 },
      zIndex: 20,
      data: {
        kind: 'quarry',
        label: q.name || 'Карьер',
        in_service: q.in_service,
        lon: q.lon,
        lat: q.lat,
        as_of: asOf,
        entry_date: q.entry_date,
        remaining_m3: q.greedy_remaining_m3,
        initial_m3: q.initial_m3,
      },
    });
  }

  for (const c of visibleConsumers) {
    if (!c.snap_node_id) continue;
    if (c.in_service) {
      totalDemand += c.demand_m3;
      totalAllocated += c.greedy_allocated_m3;
    }
    const id = consumerId(c.object_id);
    const planTotal = c.demand_plan_total_m3 ?? c.demand_m3;
    nodes.push({
      id,
      type: 'sandFlowNode',
      position: positions.get(id) ?? { x: 0, y: 0 },
      zIndex: 20,
      data: {
        kind: 'consumer',
        label: c.name || c.subtype,
        in_service: c.in_service,
        lon: c.lon,
        lat: c.lat,
        as_of: asOf,
        entry_date: c.entry_date,
        demand_m3: c.demand_m3,
        demand_plan_total_m3: planTotal,
        allocated_m3: c.greedy_allocated_m3,
      },
    });

    if (
      c.in_service &&
      c.greedy_quarry_id &&
      quarryIds.has(c.greedy_quarry_id) &&
      c.greedy_allocated_m3 > 0
    ) {
      const quarry = quarryById.get(c.greedy_quarry_id);
      const qSnap = quarry?.snap_node_id;
      const cSnap = c.snap_node_id;
      if (qSnap && cSnap) {
        const path = shortestPath(roadGraph, qSnap, cSnap);
        if (path && path.length >= 1) {
          siteLinks.add(`${quarryId(c.greedy_quarry_id)}->${networkNodeId(qSnap)}`);
          siteLinks.add(`${networkNodeId(cSnap)}->${id}`);

          if (path.length === 1) {
            siteLinks.add(`${quarryId(c.greedy_quarry_id)}->${id}`);
          } else {
            for (let i = 0; i < path.length - 1; i++) {
              const key = segmentKey(path[i]!, path[i + 1]!);
              segmentFlowM3.set(key, (segmentFlowM3.get(key) ?? 0) + c.greedy_allocated_m3);
            }
          }
        }
      }
    }

    if (
      showPlannedRoutes &&
      !c.in_service &&
      c.nearest_quarry_id &&
      quarryIds.has(c.nearest_quarry_id)
    ) {
      const quarry = quarryById.get(c.nearest_quarry_id);
      const qSnap = quarry?.snap_node_id;
      const cSnap = c.snap_node_id;
      if (!qSnap || !cSnap) continue;

      const path = shortestPath(roadGraph, qSnap, cSnap);
      if (!path || path.length < 1) continue;

      const planM3 = planTotal > 0 ? planTotal : c.demand_m3;
      const entryLabel = c.entry_date?.slice(0, 4) ?? '';
      const labelText =
        planM3 > 0
          ? `план с ${entryLabel} · ${formatSandEdgeM3(planM3)}`
          : `план с ${entryLabel}`;

      if (edgeLabelMode !== 'hidden') {
        const polyline = haulLegPolylinePoints(
          path,
          quarryId(c.nearest_quarry_id),
          id,
          positions,
        );
        if (polyline.length >= 2) {
          const mid = polylineMidpoint(polyline);
          plannedLegLabelSpecs.push({
            id: `planned-leg:${c.nearest_quarry_id}:${c.object_id}`,
            label: labelText,
            x: mid.x,
            y: mid.y,
          });
        }
      }

      plannedSiteLinks.add(`${quarryId(c.nearest_quarry_id)}->${networkNodeId(qSnap)}`);
      plannedSiteLinks.add(`${networkNodeId(cSnap)}->${id}`);

      if (path.length === 1) {
        plannedSiteLinks.add(`${quarryId(c.nearest_quarry_id)}->${id}`);
      } else {
        for (let i = 0; i < path.length - 1; i++) {
          plannedSegmentKeys.add(segmentKey(path[i]!, path[i + 1]!));
        }
      }
    }
  }

  addSiteSnapConnectors(siteLinks, plannedSiteLinks, visibleQuarries, visibleConsumers);

  const allocatedConsumerSnaps = collectAllocatedConsumerSnaps(visibleConsumers);
  const flowLabelSlots = createFlowLabelSlotTracker(edgeLabelMode);

  const simplifiedRoadPolylines = simplifyRoadNetworkPolylines(
    roadGraph,
    keyNetworkNodes,
    positions,
  );

  const roadPolylinesForLabels =
    edgeLabelMode === 'key'
      ? sortPolylinesForKeyFlowLabels(simplifiedRoadPolylines, allocatedConsumerSnaps)
      : simplifiedRoadPolylines;

  const showFlowLabelByPolyId = new Map<string, boolean>();
  for (const poly of roadPolylinesForLabels) {
    if (poly.points.length < 2) continue;
    let flowM3 = 0;
    for (const sk of poly.segmentKeys) {
      flowM3 = Math.max(flowM3, segmentFlowM3.get(sk) ?? 0);
    }
    showFlowLabelByPolyId.set(
      poly.id,
      shouldShowRoadPolylineFlowLabel(
        edgeLabelMode,
        flowM3,
        flowLabelSlots.shouldShow(poly.points, flowM3),
      ),
    );
  }

  for (const poly of simplifiedRoadPolylines) {
    if (poly.points.length < 2) continue;
    let flowM3 = 0;
    for (const sk of poly.segmentKeys) {
      flowM3 = Math.max(flowM3, segmentFlowM3.get(sk) ?? 0);
    }
    const hasFlow = flowM3 > 0;
    const planned = poly.segmentKeys.some((sk) => plannedSegmentKeys.has(sk));
    const startId = networkNodeId(poly.nodeIds[0]!);
    const endId = networkNodeId(poly.nodeIds[poly.nodeIds.length - 1]!);
    if (startId === endId) continue;
    const showFlowLabel = showFlowLabelByPolyId.get(poly.id) ?? false;

    edges.push({
      id: `road-poly-${poly.id}`,
      type: 'sandRoadPolylineEdge',
      source: startId,
      target: endId,
      selectable: false,
      zIndex: hasFlow ? 5 : 0,
      data: {
        points: poly.points,
        flowM3,
        showFlowLabel,
      } satisfies SandRoadPolylineEdgeData,
      style: hasFlow
        ? { stroke: '#b45309', strokeWidth: 4 }
        : { stroke: '#cbd5e1', strokeWidth: 2 },
    });

    if (showPlannedRoutes && planned && !hasFlow) {
      edges.push({
        id: `planned-road-poly-${poly.id}`,
        type: 'sandPlannedRoadPolylineEdge',
        source: startId,
        target: endId,
        selectable: false,
        zIndex: 2,
        data: {
          points: poly.points,
          flowM3: 0,
          planned: true,
        } satisfies SandRoadPolylineEdgeData,
        style: { stroke: '#64748b', strokeWidth: 2, strokeDasharray: '6 4' },
      });
    }
  }

  for (const linkKey of siteLinks) {
    const arrow = linkKey.indexOf('->');
    if (arrow < 0) continue;
    const source = linkKey.slice(0, arrow);
    const target = linkKey.slice(arrow + 2);
    edges.push({
      id: `link-${source}-${target}`,
      type: 'sandSiteLinkEdge',
      source,
      target,
      zIndex: 4,
      style: { stroke: '#d97706', strokeWidth: 1.5, strokeDasharray: '5 4' },
    });
  }

  for (const linkKey of plannedSiteLinks) {
    const arrow = linkKey.indexOf('->');
    if (arrow < 0) continue;
    const source = linkKey.slice(0, arrow);
    const target = linkKey.slice(arrow + 2);
    edges.push({
      id: `planned-link-${source}-${target}`,
      type: 'sandPlannedSiteLinkEdge',
      source,
      target,
      zIndex: 3,
      style: { stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '4 3' },
    });
  }

  if (edgeLabelMode !== 'hidden') {
    for (const leg of plannedLegLabelSpecs) {
      nodes.push({
        id: leg.id,
        type: 'sandPlannedLegLabel',
        position: { x: leg.x, y: leg.y },
        zIndex: 25,
        selectable: false,
        draggable: false,
        data: { kind: 'plannedLegLabel', label: leg.label },
      });
    }
  }

  ensureSchematicEndpointNodes(nodes, edges, positions, siteSpecs);

  return {
    nodes,
    edges,
    summary: {
      total_demand_m3: totalDemand,
      total_allocated_m3: totalAllocated,
      unmet_m3: Math.max(0, totalDemand - totalAllocated),
    },
    entryYears: layout.entryYears,
    siteNodeIds: layout.siteNodeIds,
    defaultViewport: layout.defaultViewport,
  };
}
