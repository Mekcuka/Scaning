import type { SandLogisticsSubnet } from '../api';
import { entryYearFromIso } from '../sandLogisticsNodeVisual';
import { SITE_H, SITE_W } from './constants';
import { computeSiteDensitySpread } from './densityViewport';
import {
  applyGeoFrameScaleBoost,
  buildGeoFrame,
  buildGeoFramePointsForSites,
  geoToTopLeft,
} from './geoFrame';
import { consumerId, quarryId } from './ids';
import { shouldShowConsumerOnSchematic, shouldShowQuarryOnSchematic } from './sliceKeys';
import { sandLogisticsToFlow } from './toFlow';
import type {
  LayoutRect,
  SandFlowNodeData,
  SandLogisticsFlowOptions,
  SiteSpec,
} from './types';

/** Расстояние центров блоков от geo-якорей (для тестов). */
export function computeSandFlowSiteAnchorDrifts(
  siteRects: Pick<LayoutRect, 'x' | 'y' | 'w' | 'h' | 'ax' | 'ay'>[],
): number[] {
  return siteRects.map((s) => {
    const cx = s.x + s.w / 2;
    const cy = s.y + s.h / 2;
    const ax = s.ax + s.w / 2;
    const ay = s.ay + s.h / 2;
    return Math.hypot(cx - ax, cy - ay);
  });
}

/** Drift site-узлов схемы от geo-якорей (для регрессионных тестов раскладки). */
export function measureSandFlowGeoDrifts(
  subnet: SandLogisticsSubnet,
  options?: SandLogisticsFlowOptions,
): number[] {
  const flow = sandLogisticsToFlow(subnet, options);
  const nodeFilter = options?.nodeFilter ?? 'all_planned';
  const siteSpecs: SiteSpec[] = [];
  for (const q of subnet.quarries.filter((row) => shouldShowQuarryOnSchematic(row, nodeFilter))) {
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
  for (const c of subnet.consumers.filter((row) => shouldShowConsumerOnSchematic(row, nodeFilter))) {
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
  const frame = buildGeoFrame(
    buildGeoFramePointsForSites(siteSpecs, subnet.network_nodes),
    density.geoMargin,
  );
  if (!frame) return [];
  applyGeoFrameScaleBoost(frame, density.geoScaleBoost);

  const drifts: number[] = [];
  for (const node of flow.nodes.filter((n) => n.type === 'sandFlowNode')) {
    const data = node.data as SandFlowNodeData;
    if (!Number.isFinite(data.lon) || !Number.isFinite(data.lat)) continue;
    const anchor = geoToTopLeft(frame, data.lon!, data.lat!, SITE_W, SITE_H);
    const cx = node.position.x + SITE_W / 2;
    const cy = node.position.y + SITE_H / 2;
    const ax = anchor.x + SITE_W / 2;
    const ay = anchor.y + SITE_H / 2;
    drifts.push(Math.hypot(cx - ax, cy - ay));
  }

  return drifts;
}
