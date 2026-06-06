import type { SandLogisticsConsumerRow, SandLogisticsQuarryRow } from '../api';
import { consumerId, networkNodeId, quarryId } from './ids';

/** Пунктир от объекта до snap-узла на дороге — для каждого объекта на схеме. */
export function addSiteSnapConnectors(
  siteLinks: Set<string>,
  plannedSiteLinks: Set<string>,
  quarries: SandLogisticsQuarryRow[],
  consumers: SandLogisticsConsumerRow[],
): void {
  for (const q of quarries) {
    if (!q.snap_node_id) continue;
    const key = `${quarryId(q.object_id)}->${networkNodeId(q.snap_node_id)}`;
    if (q.in_service) siteLinks.add(key);
    else plannedSiteLinks.add(key);
  }

  for (const c of consumers) {
    if (!c.snap_node_id) continue;
    const key = `${networkNodeId(c.snap_node_id)}->${consumerId(c.object_id)}`;
    if (c.in_service) siteLinks.add(key);
    else plannedSiteLinks.add(key);
  }
}
