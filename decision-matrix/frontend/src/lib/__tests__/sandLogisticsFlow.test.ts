import { Position } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import type { SandLogisticsSubnet } from '../api';
import {
  borderAnchorToward,
  buildSandLogisticsLayout,
  buildSandLogisticsSliceFlow,
  collectKeyNetworkNodes,
  collectSiteInfluenceNodeIds,
  computeSandFlowDefaultViewport,
  computeSiteDensitySpread,
  floatingSandSiteLinkEndpoints,
  haulLegPolylinePoints,
  measureSandFlowGeoDrifts,
  minSandFlowSitePairwiseGap,
  polylineMidpoint,
  polylineToSvgPath,
  formatSandEdgeFlow,
  sandLogisticsToFlow,
  SAND_FLOW_MAX_GEO_DRIFT,
  SAND_FLOW_SITE_H,
  SAND_FLOW_SITE_W,
  simplifyRoadNetworkPolylines,
} from '../sandLogisticsFlow';
import { resolveSubnetForSchematicAtView } from '../sandLogisticsResult';
import { resolveSandNodeStatus } from '../sandLogisticsNodeVisual';
import {
  complexSandLogisticsResult,
  mainQuarrySubnet,
  waitingOffNetworkSubnet,
} from '../../test/fixtures/sandLogisticsFixtures';
import {
  expectAllEdgeEndpointsHaveNodes,
  expectHiddenNetworkAnchors,
  expectNoSelfLoopEdges,
  expectPolylineEdgesValid,
  expectSimplifiedRoadPolylinesOnly,
} from '../../test/fixtures/sandLogisticsFlowAssert';

function minimalSubnet(): SandLogisticsSubnet {
  return {
    subnet_index: 1,
    name: 'Test',
    autoroad_edge_count: 3,
    quarry_count: 1,
    consumer_count: 1,
    network_nodes: [
      { id: 'n1', lon: 37.6, lat: 55.75 },
      { id: 'n2', lon: 37.61, lat: 55.751 },
      { id: 'n3', lon: 37.62, lat: 55.752 },
    ],
    network_edges: [
      { id: 'e1', from_node_id: 'n1', to_node_id: 'n2', length_km: 1 },
      { id: 'e2', from_node_id: 'n2', to_node_id: 'n3', length_km: 1 },
    ],
    quarries: [
      {
        object_id: 'q1',
        name: 'Карьер',
        lon: 37.599,
        lat: 55.749,
        snap_node_id: 'n1',
        in_service: true,
        entry_date: '2020-01-01',
        initial_m3: 5000,
        current_m3: 5000,
        greedy_allocated_m3: 1000,
        greedy_remaining_m3: 4000,
        proportional_allocated_m3: 0,
        proportional_exceeds_capacity: false,
      },
    ],
    consumers: [
      {
        object_id: 'c1',
        name: 'ГКС',
        subtype: 'gas_processing',
        lon: 37.621,
        lat: 55.753,
        snap_node_id: 'n3',
        demand_m3: 1000,
        entry_date: '2020-01-01',
        in_service: true,
        nearest_quarry_id: 'q1',
        nearest_quarry_name: 'Карьер',
        distance_km: 2,
        snap_to_node_km: 0.1,
        distances_to_quarries_km: { q1: 2 },
        greedy_quarry_id: 'q1',
        greedy_quarry_name: 'Карьер',
        greedy_allocated_m3: 1000,
        proportional_allocations: [],
      },
    ],
    warnings: [],
  };
}

describe('simplifyRoadNetworkPolylines', () => {
  it('collectKeyNetworkNodes includes junctions and snap points', () => {
    const adj = new Map<string, { neighbor: string; weight: number }[]>([
      ['n1', [{ neighbor: 'n2', weight: 1 }]],
      ['n2', [
        { neighbor: 'n1', weight: 1 },
        { neighbor: 'n3', weight: 1 },
        { neighbor: 'n4', weight: 1 },
      ]],
      ['n3', [{ neighbor: 'n2', weight: 1 }]],
      ['n4', [{ neighbor: 'n2', weight: 1 }]],
    ]);
    const keys = collectKeyNetworkNodes(adj, ['n1']);
    expect(keys.has('n1')).toBe(true);
    expect(keys.has('n2')).toBe(true);
    expect(keys.has('n3')).toBe(true);
    expect(keys.has('n4')).toBe(true);
  });

  it('merges degree-2 chain into one polyline', () => {
    const adj = new Map<string, { neighbor: string; weight: number }[]>([
      ['n1', [{ neighbor: 'n2', weight: 1 }]],
      ['n2', [
        { neighbor: 'n1', weight: 1 },
        { neighbor: 'n3', weight: 1 },
      ]],
      ['n3', [{ neighbor: 'n2', weight: 1 }]],
    ]);
    const positions = new Map<string, { x: number; y: number }>([
      ['n:n1', { x: 0, y: 0 }],
      ['n:n2', { x: 10, y: 0 }],
      ['n:n3', { x: 20, y: 0 }],
    ]);
    const keys = collectKeyNetworkNodes(adj, ['n1', 'n3']);
    const polylines = simplifyRoadNetworkPolylines(adj, keys, positions);
    expect(polylines).toHaveLength(1);
    expect(polylines[0]?.nodeIds).toEqual(['n1', 'n2', 'n3']);
    expect(polylines[0]?.segmentKeys).toHaveLength(2);
  });
});

describe('sandLogisticsFlow schematic integrity', () => {
  it('main quarry subnet builds valid simplified graph', () => {
    const flow = sandLogisticsToFlow(mainQuarrySubnet(), { showPlannedRoutes: true });
    expectAllEdgeEndpointsHaveNodes(flow);
    expectSimplifiedRoadPolylinesOnly(flow);
    expectPolylineEdgesValid(flow);
    expectNoSelfLoopEdges(flow);
    expectHiddenNetworkAnchors(flow.nodes);
  });

  it('waiting off-network subnet does not crash and has no road edges', () => {
    const flow = sandLogisticsToFlow(waitingOffNetworkSubnet());
    expectAllEdgeEndpointsHaveNodes(flow);
    expect(flow.edges.filter((e) => e.type === 'sandRoadPolylineEdge')).toHaveLength(0);
    expect(flow.nodes.some((n) => n.type === 'sandFlowNode')).toBe(false);
  });

  it('each subnet from complex result yields valid graph', () => {
    const result = complexSandLogisticsResult();
    for (const subnet of result.subnets) {
      const flow = sandLogisticsToFlow(subnet, { showPlannedRoutes: true });
      expectAllEdgeEndpointsHaveNodes(flow);
      expectNoSelfLoopEdges(flow);
    }
  });

  it('timeline slices from complex result yield valid graphs', () => {
    const result = complexSandLogisticsResult();
    for (const step of result.timeline) {
      for (const subnet of step.subnets) {
        const flow = sandLogisticsToFlow(subnet, { showPlannedRoutes: true });
        expectAllEdgeEndpointsHaveNodes(flow);
      }
    }
  });
});

describe('sandLogisticsFlow edge labels', () => {
  it('polylineMidpoint returns center of two-point line', () => {
    expect(polylineMidpoint([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ])).toEqual({ x: 50, y: 0 });
  });

  it('key mode labels road polylines once, not per consumer leg nodes', () => {
    const flow = sandLogisticsToFlow(minimalSubnet(), { edgeLabelMode: 'key' });
    expect(flow.nodes.filter((n) => n.type === 'sandLegLabel')).toHaveLength(0);
    const labeledRoads = flow.edges.filter(
      (e) =>
        e.type === 'sandRoadPolylineEdge' &&
        (e.data as { flowM3?: number; showFlowLabel?: boolean }).flowM3! > 0 &&
        (e.data as { showFlowLabel?: boolean }).showFlowLabel !== false,
    );
    expect(labeledRoads.length).toBeGreaterThan(0);
    expect(labeledRoads.length).toBeLessThanOrEqual(
      flow.edges.filter((e) => e.type === 'sandRoadPolylineEdge').length,
    );
  });

  it('hidden mode adds no leg label nodes', () => {
    const flow = sandLogisticsToFlow(minimalSubnet(), { edgeLabelMode: 'hidden' });
    expect(flow.nodes.filter((n) => n.type === 'sandLegLabel')).toHaveLength(0);
  });

  it('all mode does not add leg label nodes', () => {
    const flow = sandLogisticsToFlow(minimalSubnet(), { edgeLabelMode: 'all' });
    expect(flow.nodes.filter((n) => n.type === 'sandLegLabel')).toHaveLength(0);
  });

  it('key mode dedupes volume labels when many consumers share road trunk', () => {
    const flow = sandLogisticsToFlow(denseSandSubnet(), { edgeLabelMode: 'key' });
    expect(flow.nodes.filter((n) => n.type === 'sandLegLabel')).toHaveLength(0);
    const roadWithFlow = flow.edges.filter(
      (e) =>
        e.type === 'sandRoadPolylineEdge' &&
        (e.data as { flowM3?: number }).flowM3! > 0,
    );
    const visibleLabels = roadWithFlow.filter(
      (e) => (e.data as { showFlowLabel?: boolean }).showFlowLabel !== false,
    );
    expect(visibleLabels.length).toBeGreaterThan(0);
    expect(visibleLabels.length).toBeLessThanOrEqual(roadWithFlow.length);
    const firstLabel = visibleLabels[0]?.data as { flowM3?: number; showFlowLabel?: boolean };
    expect(firstLabel.showFlowLabel).not.toBe(false);
  });

  it('formats edge flow like technological schematic', () => {
    expect(formatSandEdgeFlow(5100)).toMatch(/5[,.]?1\s*тыс\. м³\/г/);
    expect(formatSandEdgeFlow(1000)).toMatch(/1\s*тыс\. м³\/г/);
  });

  it('minimal subnet uses one simplified road polyline instead of per-segment edges', () => {
    const flow = sandLogisticsToFlow(minimalSubnet());
    const roadPolylines = flow.edges.filter((e) => e.type === 'sandRoadPolylineEdge');
    expect(roadPolylines).toHaveLength(1);
    const points = (roadPolylines[0]?.data as { points?: { x: number; y: number }[] })?.points;
    expect(points?.length).toBeGreaterThanOrEqual(3);
    const anchors = flow.nodes.filter((n) => n.type === 'sandNetworkNode');
    expect(anchors.length).toBeLessThan(minimalSubnet().network_nodes.length);
  });

  it('polylineToSvgPath draws multi-point line for all line styles', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 5 },
    ];
    for (const style of ['straight', 'bezier', 'smoothstep'] as const) {
      const [path] = polylineToSvgPath(style, points);
      expect(path.length).toBeGreaterThan(0);
      expect(path.startsWith('M')).toBe(true);
    }
  });

  it('haulLegPolylinePoints includes quarry, path nodes, consumer', () => {
    const positions = new Map<string, { x: number; y: number }>([
      ['q:q1', { x: 10, y: 20 }],
      ['n:n1', { x: 30, y: 40 }],
      ['n:n2', { x: 50, y: 60 }],
      ['n:n3', { x: 70, y: 80 }],
      ['c:c1', { x: 90, y: 100 }],
    ]);
    const pts = haulLegPolylinePoints(['n1', 'n2', 'n3'], 'q:q1', 'c:c1', positions);
    expect(pts.length).toBe(5);
  });

  it('every edge endpoint has a matching node (missing network_nodes coords)', () => {
    const subnet: SandLogisticsSubnet = {
      ...minimalSubnet(),
      network_nodes: [{ id: 'n2', lon: 37.61, lat: 55.751 }],
      network_edges: [
        { id: 'e1', from_node_id: 'n1', to_node_id: 'n2', length_km: 1 },
        { id: 'e2', from_node_id: 'n2', to_node_id: 'n3', length_km: 1 },
      ],
    };
    const flow = sandLogisticsToFlow(subnet);
    const nodeIds = new Set(flow.nodes.map((n) => n.id));
    for (const edge of flow.edges) {
      expect(nodeIds.has(String(edge.source)), `missing source ${edge.source}`).toBe(true);
      expect(nodeIds.has(String(edge.target)), `missing target ${edge.target}`).toBe(true);
    }
  });
});

function subnetWithFutureConsumer(): SandLogisticsSubnet {
  const base = minimalSubnet();
  return {
    ...base,
    consumer_count: 2,
    network_nodes: [
      ...base.network_nodes,
      { id: 'n4', lon: 37.625, lat: 55.754 },
    ],
    network_edges: [
      ...base.network_edges,
      { id: 'e3', from_node_id: 'n3', to_node_id: 'n4', length_km: 0.5 },
    ],
    consumers: [
      ...base.consumers,
      {
        object_id: 'c2',
        name: 'ГКС будущий',
        subtype: 'gas_processing',
        lon: 37.626,
        lat: 55.755,
        snap_node_id: 'n4',
        demand_m3: 0,
        demand_plan_total_m3: 800,
        entry_date: '2027-01-01',
        in_service: false,
        nearest_quarry_id: 'q1',
        nearest_quarry_name: 'Карьер',
        distance_km: 2.5,
        snap_to_node_km: 0.1,
        distances_to_quarries_km: { q1: 2.5 },
        greedy_quarry_id: null,
        greedy_quarry_name: null,
        greedy_allocated_m3: 0,
        proportional_allocations: [],
      },
    ],
  };
}

describe('sandLogisticsFlow entry dates', () => {
  it('showPlannedRoutes adds planned road edges without flow', () => {
    const flow = sandLogisticsToFlow(subnetWithFutureConsumer(), {
      showPlannedRoutes: true,
      edgeLabelMode: 'key',
    });
    expect(flow.edges.some((e) => e.type === 'sandPlannedRoadPolylineEdge')).toBe(true);
    const plannedRoads = flow.edges.filter((e) => e.type === 'sandPlannedRoadPolylineEdge');
    for (const e of plannedRoads) {
      expect((e.data as { flowM3?: number })?.flowM3 ?? 0).toBe(0);
    }
    expect(flow.nodes.some((n) => n.type === 'sandPlannedLegLabel')).toBe(true);
  });

  it('nodeFilter in_service hides future consumer', () => {
    const flow = sandLogisticsToFlow(subnetWithFutureConsumer(), {
      nodeFilter: 'in_service',
    });
    expect(flow.nodes.filter((n) => n.id === 'c:c2')).toHaveLength(0);
    expect(flow.nodes.filter((n) => n.id === 'c:c1')).toHaveLength(1);
  });

  it('nodeFilter allocated_only keeps only consumer with shipment', () => {
    const flow = sandLogisticsToFlow(subnetWithFutureConsumer(), {
      nodeFilter: 'allocated_only',
    });
    const consumerNodes = flow.nodes.filter((n) => n.type === 'sandFlowNode' && n.id.startsWith('c:'));
    expect(consumerNodes).toHaveLength(1);
    expect(consumerNodes[0]?.id).toBe('c:c1');
  });

  it('passes entry_date and as_of into node data', () => {
    const flow = sandLogisticsToFlow(minimalSubnet(), { as_of: '2025-06-01' });
    const consumer = flow.nodes.find((n) => n.id === 'c:c1');
    expect(consumer?.data).toMatchObject({
      entry_date: '2020-01-01',
      as_of: '2025-06-01',
    });
  });
});

function denseSandSubnet(): SandLogisticsSubnet {
  const network_nodes: SandLogisticsSubnet['network_nodes'] = [];
  const network_edges: SandLogisticsSubnet['network_edges'] = [];
  for (let i = 0; i < 8; i++) {
    const id = `n${i}`;
    network_nodes.push({ id, lon: 37.6 + i * 0.003, lat: 55.75 + i * 0.0004 });
    if (i > 0) {
      network_edges.push({
        id: `e${i}`,
        from_node_id: `n${i - 1}`,
        to_node_id: id,
        length_km: 1,
      });
    }
  }

  const quarries: SandLogisticsSubnet['quarries'] = [
    {
      object_id: 'q1',
      name: 'Карьер песка_1',
      lon: 37.599,
      lat: 55.749,
      snap_node_id: 'n0',
      in_service: true,
      entry_date: '2020-01-01',
      initial_m3: 5000,
      current_m3: 5000,
      greedy_allocated_m3: 1000,
      greedy_remaining_m3: 4000,
      proportional_allocated_m3: 0,
      proportional_exceeds_capacity: false,
    },
    {
      object_id: 'q2',
      name: 'Карьер песка_2',
      lon: 37.603,
      lat: 55.7505,
      snap_node_id: 'n1',
      in_service: true,
      entry_date: '2020-01-01',
      initial_m3: 5000,
      current_m3: 5000,
      greedy_allocated_m3: 1000,
      greedy_remaining_m3: 4000,
      proportional_allocated_m3: 0,
      proportional_exceeds_capacity: false,
    },
  ];

  const consumers: SandLogisticsSubnet['consumers'] = Array.from({ length: 7 }, (_, i) => ({
    object_id: `c${i + 1}`,
    name: `ГКС_${i + 1}`,
    subtype: 'oil_pad' as const,
    lon: 37.612 + i * 0.003,
    lat: 55.752 + i * 0.00035,
    snap_node_id: `n${Math.min(i + 2, 7)}`,
    demand_m3: 500,
    entry_date: '2020-01-01',
    in_service: true,
    nearest_quarry_id: 'q2',
    nearest_quarry_name: 'Карьер песка_2',
    distance_km: 2,
    snap_to_node_km: 0.1,
    distances_to_quarries_km: { q2: 2 },
    greedy_quarry_id: 'q2',
    greedy_quarry_name: 'Карьер песка_2',
    greedy_allocated_m3: 500,
    proportional_allocations: [],
  }));

  return {
    subnet_index: 1,
    name: 'Dense sand subnet',
    autoroad_edge_count: network_edges.length,
    quarry_count: quarries.length,
    consumer_count: consumers.length,
    network_nodes,
    network_edges,
    quarries,
    consumers,
    warnings: [],
  };
}

function subnetWithSideBranch(extraBranchNodes: number): SandLogisticsSubnet {
  const network_nodes: SandLogisticsSubnet['network_nodes'] = [{ id: 'n0', lon: 37.6, lat: 55.75 }];
  const network_edges: SandLogisticsSubnet['network_edges'] = [];
  for (let i = 0; i < 12; i++) {
    const id = `m${i}`;
    network_nodes.push({ id, lon: 37.6 + (i + 1) * 0.001, lat: 55.75 });
    network_edges.push({
      id: `e${i}`,
      from_node_id: i === 0 ? 'n0' : `m${i - 1}`,
      to_node_id: id,
      length_km: 1,
    });
  }
  const lastMain = 'm11';
  network_nodes.push({ id: 'nEnd', lon: 37.614, lat: 55.75 });
  network_edges.push({
    id: 'eEnd',
    from_node_id: lastMain,
    to_node_id: 'nEnd',
    length_km: 1,
  });

  network_nodes.push({ id: 'branch0', lon: 37.606, lat: 55.751 });
  network_edges.push({
    id: 'eBranch0',
    from_node_id: 'm5',
    to_node_id: 'branch0',
    length_km: 0.5,
  });
  for (let i = 0; i < extraBranchNodes; i++) {
    const id = `branch${i + 1}`;
    const prev = i === 0 ? 'branch0' : `branch${i}`;
    network_nodes.push({ id, lon: 37.606 + (i + 1) * 0.0005, lat: 55.751 + (i + 1) * 0.0003 });
    network_edges.push({
      id: `eBranch${i + 1}`,
      from_node_id: prev,
      to_node_id: id,
      length_km: 0.5,
    });
  }

  return {
    subnet_index: 1,
    name: 'Long chain with branch',
    autoroad_edge_count: network_edges.length,
    quarry_count: 1,
    consumer_count: 1,
    network_nodes,
    network_edges,
    quarries: [
      {
        object_id: 'q1',
        name: 'Карьер',
        lon: 37.599,
        lat: 55.749,
        snap_node_id: 'n0',
        in_service: true,
        entry_date: '2020-01-01',
        initial_m3: 5000,
        current_m3: 5000,
        greedy_allocated_m3: 1000,
        greedy_remaining_m3: 4000,
        proportional_allocated_m3: 0,
        proportional_exceeds_capacity: false,
      },
    ],
    consumers: [
      {
        object_id: 'c1',
        name: 'ГКС',
        subtype: 'oil_pad',
        lon: 37.615,
        lat: 55.751,
        snap_node_id: 'nEnd',
        demand_m3: 1000,
        entry_date: '2020-01-01',
        in_service: true,
        nearest_quarry_id: 'q1',
        nearest_quarry_name: 'Карьер',
        distance_km: 5,
        snap_to_node_km: 0.1,
        distances_to_quarries_km: { q1: 5 },
        greedy_quarry_id: 'q1',
        greedy_quarry_name: 'Карьер',
        greedy_allocated_m3: 1000,
        proportional_allocations: [],
      },
    ],
    warnings: [],
  };
}

describe('sandLogisticsFlow floating site connectors', () => {
  function box(
    x: number,
    y: number,
    w = SAND_FLOW_SITE_W,
    h = SAND_FLOW_SITE_H,
    type = 'sandFlowNode',
  ) {
    return {
      type,
      measured: { width: w, height: h },
      internals: { positionAbsolute: { x, y } },
    };
  }

  it('picks right border when snap is to the east', () => {
    const node = box(100, 100);
    const anchor = borderAnchorToward(node, { x: 300, y: 134 });
    expect(anchor.position).toBe(Position.Right);
    expect(anchor.x).toBeCloseTo(260, 0);
    expect(anchor.y).toBeCloseTo(134, 0);
  });

  it('picks top border when snap is above the block', () => {
    const node = box(200, 200);
    const anchor = borderAnchorToward(node, { x: 260, y: 50 });
    expect(anchor.position).toBe(Position.Top);
    expect(anchor.y).toBeCloseTo(200, 0);
  });

  it('connects both ends on nearest borders', () => {
    const quarry = box(0, 100);
    const snap = box(250, 80, 10, 10, 'sandNetworkNode');
    const endpoints = floatingSandSiteLinkEndpoints(quarry, snap);
    expect(endpoints.sourcePosition).toBe(Position.Right);
    expect(endpoints.targetPosition).toBe(Position.Left);
    expect(endpoints.sourceX).toBeGreaterThan(endpoints.targetX - 200);
  });
});

describe('sandLogisticsFlow geo layout', () => {
  it('every visible site with snap has a connector to the road network', () => {
    const flow = sandLogisticsToFlow(mainQuarrySubnet(), { showPlannedRoutes: true });
    const siteNodes = flow.nodes.filter((n) => n.type === 'sandFlowNode');
    expect(siteNodes.length).toBeGreaterThan(0);

    for (const site of siteNodes) {
      const connected = flow.edges.some(
        (e) =>
          (e.type === 'sandSiteLinkEdge' || e.type === 'sandPlannedSiteLinkEdge') &&
          (e.source === site.id || e.target === site.id),
      );
      expect(connected, `site ${site.id} missing snap connector`).toBe(true);
    }
  });

  it('unallocated in-service consumers still have snap connectors', () => {
    const subnet = mainQuarrySubnet();
    const unallocated = subnet.consumers.find((c) => c.greedy_allocated_m3 === 0 && c.in_service);
    expect(unallocated).toBeTruthy();

    const flow = sandLogisticsToFlow(subnet, { showPlannedRoutes: true });
    const siteId = `c:${unallocated!.object_id}`;
    const connected = flow.edges.some(
      (e) =>
        (e.type === 'sandSiteLinkEdge' || e.type === 'sandPlannedSiteLinkEdge') &&
        (e.source === siteId || e.target === siteId),
    );
    expect(connected).toBe(true);
  });

  it('returns siteNodeIds for visible objects', () => {
    const flow = sandLogisticsToFlow(mainQuarrySubnet(), { showPlannedRoutes: true });
    expect(flow.siteNodeIds.length).toBeGreaterThan(0);
    expect(flow.siteNodeIds.every((id) => id.startsWith('q:') || id.startsWith('c:'))).toBe(true);
    for (const id of flow.siteNodeIds) {
      expect(flow.nodes.some((n) => n.id === id && n.type === 'sandFlowNode')).toBe(true);
    }
  });

  it('computes defaultViewport that frames all site nodes', () => {
    const flow = sandLogisticsToFlow(mainQuarrySubnet(), { showPlannedRoutes: true });
    const vp = computeSandFlowDefaultViewport(flow.nodes, flow.siteNodeIds, 720, 520);
    expect(vp.zoom).toBeGreaterThan(0.12);
    expect(vp.zoom).toBeLessThanOrEqual(1.5);
    expect(flow.defaultViewport.zoom).toBeGreaterThan(0.12);

    for (const id of flow.siteNodeIds) {
      const node = flow.nodes.find((n) => n.id === id);
      expect(node).toBeTruthy();
      const sx = node!.position.x * vp.zoom + vp.x;
      const sy = node!.position.y * vp.zoom + vp.y;
      const ex = (node!.position.x + SAND_FLOW_SITE_W) * vp.zoom + vp.x;
      const ey = (node!.position.y + SAND_FLOW_SITE_H) * vp.zoom + vp.y;
      expect(sx).toBeGreaterThan(0);
      expect(sy).toBeGreaterThan(0);
      expect(ex).toBeLessThan(720);
      expect(ey).toBeLessThan(520);
    }
  });

  it('preserves east-west geo ordering on main quarry subnet', () => {
    const subnet = mainQuarrySubnet();
    const flow = sandLogisticsToFlow(subnet, { showPlannedRoutes: true });
    const consumers = subnet.consumers
      .filter((c) => c.snap_node_id)
      .sort((a, b) => a.lon - b.lon);

    for (let i = 0; i < consumers.length - 1; i++) {
      const left = flow.nodes.find((n) => n.id === `c:${consumers[i]!.object_id}`);
      const right = flow.nodes.find((n) => n.id === `c:${consumers[i + 1]!.object_id}`);
      expect(left && right).toBeTruthy();
      const leftCx = left!.position.x + SAND_FLOW_SITE_W / 2;
      const rightCx = right!.position.x + SAND_FLOW_SITE_W / 2;
      expect(leftCx).toBeLessThanOrEqual(rightCx + 20);
    }
  });

  it('keeps site blocks within adaptive max geo drift from anchors', () => {
    const subnet = mainQuarrySubnet();
    const flow = sandLogisticsToFlow(subnet, { showPlannedRoutes: true });
    const drifts = measureSandFlowGeoDrifts(subnet, { showPlannedRoutes: true });
    const { maxDrift } = computeSiteDensitySpread(flow.siteNodeIds.length);
    expect(drifts.length).toBeGreaterThan(0);
    for (const drift of drifts) {
      expect(drift).toBeLessThanOrEqual(maxDrift + 1);
    }
    const mean = drifts.reduce((a, b) => a + b, 0) / drifts.length;
    expect(mean).toBeLessThan(maxDrift * 0.85);
  });

  it('maintains minimum pairwise gap between site blocks on main quarry subnet', () => {
    const flow = sandLogisticsToFlow(mainQuarrySubnet(), { showPlannedRoutes: true });
    const { layoutGap } = computeSiteDensitySpread(flow.siteNodeIds.length);
    const gap = minSandFlowSitePairwiseGap(flow.nodes, flow.siteNodeIds);
    expect(gap).toBeGreaterThanOrEqual(layoutGap);
  });

  it('maintains wide pairwise gaps on dense nine-site subnet', () => {
    const flow = sandLogisticsToFlow(denseSandSubnet(), { showPlannedRoutes: true });
    expect(flow.siteNodeIds.length).toBe(9);
    const gap = minSandFlowSitePairwiseGap(flow.nodes, flow.siteNodeIds);
    expect(gap).toBeGreaterThanOrEqual(24);
  });

  it('groupByEntryYear keeps site blocks separated', () => {
    const subnet = denseSandSubnet();
    for (const [i, c] of subnet.consumers.entries()) {
      c.entry_date = i % 2 === 0 ? '2020-01-01' : '2022-01-01';
    }
    const flow = sandLogisticsToFlow(subnet, {
      showPlannedRoutes: true,
      groupByEntryYear: true,
    });
    const { layoutGap } = computeSiteDensitySpread(flow.siteNodeIds.length);
    const gap = minSandFlowSitePairwiseGap(flow.nodes, flow.siteNodeIds);
    expect(gap).toBeGreaterThanOrEqual(layoutGap);
  });

  it('computeSiteDensitySpread scales with site count', () => {
    const sparse = computeSiteDensitySpread(3);
    expect(sparse.layoutGap).toBe(10);
    expect(sparse.geoScaleBoost).toBe(1);
    expect(sparse.geoMargin).toBe(0.14);
    expect(sparse.maxDrift).toBe(SAND_FLOW_MAX_GEO_DRIFT);

    const medium = computeSiteDensitySpread(6);
    expect(medium.layoutGap).toBe(19);
    expect(medium.geoScaleBoost).toBe(1.24);
    expect(medium.geoMargin).toBeCloseTo(0.2, 5);
    expect(medium.maxDrift).toBe(SAND_FLOW_MAX_GEO_DRIFT + 36);

    const dense = computeSiteDensitySpread(9);
    expect(dense.layoutGap).toBe(28);
    expect(dense.geoScaleBoost).toBe(1.48);
    expect(dense.geoMargin).toBeCloseTo(0.26, 5);
    expect(dense.maxDrift).toBe(SAND_FLOW_MAX_GEO_DRIFT + 72);
  });

  it('excludes side-branch nodes from influence set', () => {
    const subnet = subnetWithSideBranch(8);
    const siteSpecs = [
      { id: 'q:q1', snapNodeId: 'n0', kind: 'quarry' as const, lon: 37.599, lat: 55.749, entryYear: 2020 },
      { id: 'c:c1', snapNodeId: 'nEnd', kind: 'consumer' as const, lon: 37.615, lat: 55.751, entryYear: 2020 },
    ];
    const roadGraph = new Map<string, { neighbor: string; weight: number }[]>();
    for (const edge of subnet.network_edges ?? []) {
      if (!roadGraph.has(edge.from_node_id)) roadGraph.set(edge.from_node_id, []);
      if (!roadGraph.has(edge.to_node_id)) roadGraph.set(edge.to_node_id, []);
      roadGraph.get(edge.from_node_id)!.push({ neighbor: edge.to_node_id, weight: edge.length_km || 1 });
      roadGraph.get(edge.to_node_id)!.push({ neighbor: edge.from_node_id, weight: edge.length_km || 1 });
    }
    const influence = collectSiteInfluenceNodeIds(siteSpecs, roadGraph);
    expect(influence.has('n0')).toBe(true);
    expect(influence.has('nEnd')).toBe(true);
    expect(influence.has('branch8')).toBe(false);
  });

  it('scoped repel keeps low drift with long side branch', () => {
    const drifts = measureSandFlowGeoDrifts(subnetWithSideBranch(12));
    expect(drifts.length).toBe(2);
    for (const drift of drifts) {
      expect(drift).toBeLessThanOrEqual(SAND_FLOW_MAX_GEO_DRIFT + 1);
    }
  });

  it('builds full schematic at early view with future objects gray', () => {
    const result = complexSandLogisticsResult();
    const subnet = resolveSubnetForSchematicAtView(result, mainQuarrySubnet(), '2019-12-31');
    const flow = sandLogisticsToFlow(subnet, {
      nodeFilter: 'all_planned',
      showPlannedRoutes: true,
      as_of: '2019-12-31',
    });

    expect(flow.siteNodeIds.length).toBeGreaterThan(1);
    expect(flow.edges.some((e) => e.type === 'sandRoadPolylineEdge')).toBe(true);

    const siteNodes = flow.nodes.filter((n) => n.type === 'sandFlowNode');
    expect(siteNodes.length).toBeGreaterThan(1);
    expect(siteNodes.every((n) => resolveSandNodeStatus(n.data as never) === 'future')).toBe(true);
  });

  it('layout positions stay stable across slice years', () => {
    const result = complexSandLogisticsResult();
    const canonical = mainQuarrySubnet();
    const slice2019 = resolveSubnetForSchematicAtView(result, canonical, '2019-12-31');
    const slice2023 = resolveSubnetForSchematicAtView(result, canonical, '2023-12-31');

    const layout = buildSandLogisticsLayout(canonical, { nodeFilter: 'all_planned' });
    const flow2019 = buildSandLogisticsSliceFlow(layout, slice2019, {
      nodeFilter: 'all_planned',
      showPlannedRoutes: true,
      as_of: '2019-12-31',
    });
    const flow2023 = buildSandLogisticsSliceFlow(layout, slice2023, {
      nodeFilter: 'all_planned',
      showPlannedRoutes: true,
      as_of: '2023-12-31',
    });

    const pos2019 = new Map(
      flow2019.nodes
        .filter((n) => n.type === 'sandFlowNode')
        .map((n) => [n.id, n.position]),
    );
    const pos2023 = new Map(
      flow2023.nodes
        .filter((n) => n.type === 'sandFlowNode')
        .map((n) => [n.id, n.position]),
    );

    expect(pos2019.size).toBeGreaterThan(0);
    for (const [id, pos] of pos2019) {
      expect(pos2023.get(id)).toEqual(pos);
    }

    expect(flow2019.summary.total_allocated_m3).toBe(0);
    expect(flow2023.summary.total_allocated_m3).toBeGreaterThan(0);
  });

  it('sandLogisticsToFlow matches layout plus slice', () => {
    const subnet = mainQuarrySubnet();
    const options = {
      nodeFilter: 'all_planned' as const,
      showPlannedRoutes: true,
      as_of: '2023-12-31',
    };
    const combined = sandLogisticsToFlow(subnet, options);
    const layout = buildSandLogisticsLayout(subnet, options);
    const sliced = buildSandLogisticsSliceFlow(layout, subnet, options);

    expect(sliced.siteNodeIds).toEqual(combined.siteNodeIds);
    expect(sliced.summary).toEqual(combined.summary);
    expect(sliced.nodes.filter((n) => n.type === 'sandFlowNode').length).toBe(
      combined.nodes.filter((n) => n.type === 'sandFlowNode').length,
    );
  });
});
