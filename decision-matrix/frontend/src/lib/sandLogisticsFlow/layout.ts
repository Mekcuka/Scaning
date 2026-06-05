import type { SandLogisticsSubnet } from '../api';
import { entryYearFromIso } from '../sandLogisticsNodeVisual';
import { NET_SIZE, SITE_H, SITE_W } from './constants';
import { computeSandFlowDefaultViewport, computeSiteDensitySpread } from './densityViewport';
import {
  applyGeoFrameScaleBoost,
  buildGeoFrame,
  buildGeoFramePointsForSites,
  geoKey,
  geoToTopLeftForNetworkNode,
  siteGeoAnchor,
} from './geoFrame';
import { consumerId, networkNodeId, quarryId } from './ids';
import {
  buildLayoutRoadSegments,
  buildRoadGraph,
  collectSiteInfluenceNodeIds,
} from './roadGraph';
import { collectKeyNetworkNodes } from './roadPolylines';
import { applyEntryYearLaneOffset } from './schematicNodes';
import { resolveSiteLayout } from './siteLayout';
import { computeSandLogisticsTopologyKey, shouldShowConsumerOnSchematic, shouldShowQuarryOnSchematic } from './sliceKeys';
import type {
  LayoutRect,
  SandLogisticsLayoutOptions,
  SandLogisticsLayoutResult,
  SiteSpec,
} from './types';

export function buildSandLogisticsLayout(
  result: SandLogisticsSubnet,
  options?: SandLogisticsLayoutOptions,
): SandLogisticsLayoutResult {
  const nodeFilter = options?.nodeFilter ?? 'all_planned';
  const groupByEntryYear = options?.groupByEntryYear ?? false;

  const visibleQuarries = result.quarries.filter((q) => shouldShowQuarryOnSchematic(q, nodeFilter));
  const visibleConsumers = result.consumers.filter((c) =>
    shouldShowConsumerOnSchematic(c, nodeFilter),
  );

  const roadGraph = buildRoadGraph(result);

  const siteSpecs: SiteSpec[] = [];
  for (const q of visibleQuarries) {
    if (!q.snap_node_id) continue;
    if (Number.isFinite(q.lon) && Number.isFinite(q.lat) && (q.lon !== 0 || q.lat !== 0)) {
      siteSpecs.push({
        id: quarryId(q.object_id),
        snapNodeId: q.snap_node_id,
        kind: 'quarry',
        lon: q.lon,
        lat: q.lat,
        entryYear: entryYearFromIso(q.entry_date),
      });
    }
  }
  for (const c of visibleConsumers) {
    if (!c.snap_node_id) continue;
    if (Number.isFinite(c.lon) && Number.isFinite(c.lat) && (c.lon !== 0 || c.lat !== 0)) {
      siteSpecs.push({
        id: consumerId(c.object_id),
        snapNodeId: c.snap_node_id,
        kind: 'consumer',
        lon: c.lon,
        lat: c.lat,
        entryYear: entryYearFromIso(c.entry_date),
      });
    }
  }

  const density = computeSiteDensitySpread(siteSpecs.length);
  const frameGeoPoints = buildGeoFramePointsForSites(siteSpecs, result.network_nodes);
  const frame = buildGeoFrame(frameGeoPoints, density.geoMargin);
  const positions = new Map<string, { x: number; y: number }>();

  if (frame) {
    applyGeoFrameScaleBoost(frame, density.geoScaleBoost);
  }

  const snapCenters = new Map<string, { cx: number; cy: number }>();
  let layoutSiteRects: LayoutRect[] = [];

  if (frame) {
    for (const nn of result.network_nodes ?? []) {
      if (!Number.isFinite(nn.lon) || !Number.isFinite(nn.lat)) continue;
      const id = networkNodeId(nn.id);
      const topLeft = geoToTopLeftForNetworkNode(frame, nn.lon, nn.lat);
      positions.set(id, topLeft);
      snapCenters.set(nn.id, {
        cx: topLeft.x + NET_SIZE / 2,
        cy: topLeft.y + NET_SIZE / 2,
      });
    }

    const siteSnapIds = new Map<string, string>();
    const geoKeyById = new Map<string, string>();
    const siteSpecById = new Map<string, SiteSpec>();
    const siteRects: LayoutRect[] = siteSpecs.map((spec) => {
      siteSnapIds.set(spec.id, spec.snapNodeId);
      geoKeyById.set(spec.id, geoKey(spec.lon, spec.lat));
      siteSpecById.set(spec.id, spec);
      const anchor = siteGeoAnchor(frame, spec);
      return {
        id: spec.id,
        x: anchor.x,
        y: anchor.y,
        w: SITE_W,
        h: SITE_H,
        ax: anchor.x,
        ay: anchor.y,
      };
    });

    if (siteRects.length > 0) {
      const influenceNodeIds = collectSiteInfluenceNodeIds(siteSpecs, roadGraph);
      const roadSegments = buildLayoutRoadSegments(result.network_edges, positions, influenceNodeIds);
      resolveSiteLayout(
        siteRects,
        roadSegments,
        snapCenters,
        siteSnapIds,
        geoKeyById,
        frame,
        siteSpecById,
        influenceNodeIds,
        density,
      );
      layoutSiteRects = siteRects;
      for (const s of siteRects) {
        positions.set(s.id, { x: s.x, y: s.y });
      }
    }
  }

  const entryYears = applyEntryYearLaneOffset(positions, siteSpecs, groupByEntryYear);

  const snapNodeIds = new Set<string>();
  for (const q of visibleQuarries) {
    if (q.snap_node_id) snapNodeIds.add(q.snap_node_id);
  }
  for (const c of visibleConsumers) {
    if (c.snap_node_id) snapNodeIds.add(c.snap_node_id);
  }
  const keyNetworkNodes = collectKeyNetworkNodes(roadGraph, snapNodeIds);

  const siteNodeIds: string[] = [];
  for (const q of visibleQuarries) {
    if (!q.snap_node_id) continue;
    siteNodeIds.push(quarryId(q.object_id));
  }
  for (const c of visibleConsumers) {
    if (!c.snap_node_id) continue;
    siteNodeIds.push(consumerId(c.object_id));
  }

  const layoutNodesForViewport = siteNodeIds.map((id) => ({
    id,
    position: positions.get(id) ?? { x: 0, y: 0 },
  }));
  const defaultViewport = computeSandFlowDefaultViewport(layoutNodesForViewport, siteNodeIds);

  return {
    topologyKey: computeSandLogisticsTopologyKey(result),
    positions,
    siteNodeIds,
    defaultViewport,
    roadGraph,
    keyNetworkNodes,
    layoutSiteRects: layoutSiteRects.map((r) => ({
      id: r.id,
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
    })),
    entryYears,
    siteSpecs,
  };
}
