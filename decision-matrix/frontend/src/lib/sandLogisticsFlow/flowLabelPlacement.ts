import { polylineMidpoint } from './roadPolylines';
import type { SandLogisticsEdgeLabelMode } from './types';

const KEY_LABEL_MERGE_PX = 80;

type LabelSlot = { x: number; y: number; flowM3: number };

export function collectAllocatedConsumerSnaps(
  consumers: { snap_node_id?: string | null; greedy_allocated_m3?: number; in_service?: boolean }[],
): Set<string> {
  const snaps = new Set<string>();
  for (const c of consumers) {
    if (!c.snap_node_id) continue;
    if (c.in_service && (c.greedy_allocated_m3 ?? 0) > 0) {
      snaps.add(c.snap_node_id);
    }
  }
  return snaps;
}

/** Слоты подписей объёма — dedupe в режиме «ключевые». */
export function createFlowLabelSlotTracker(mode: SandLogisticsEdgeLabelMode) {
  const slots: LabelSlot[] = [];

  return {
    shouldShow(points: { x: number; y: number }[], flowM3: number): boolean {
      if (mode === 'hidden' || flowM3 <= 0) return false;
      if (points.length < 2) return false;

      const mid = polylineMidpoint(points);
      const lx = mid.x;
      const ly = mid.y;

      const mergePx = mode === 'key' ? KEY_LABEL_MERGE_PX : 52;
      for (const slot of slots) {
        if (Math.hypot(slot.x - lx, slot.y - ly) < mergePx) {
          if (mode === 'all') {
            if (slot.flowM3 === flowM3) return false;
          } else {
            return false;
          }
        }
      }
      slots.push({ x: lx, y: ly, flowM3 });
      return true;
    },
  };
}

/** key — одна подпись на объединённый участок сети; all — все участки с dedupe одинаковых значений. */
export function shouldShowRoadPolylineFlowLabel(
  mode: SandLogisticsEdgeLabelMode,
  flowM3: number,
  slotAllowed: boolean,
): boolean {
  if (mode === 'hidden' || flowM3 <= 0 || !slotAllowed) return false;
  return true;
}

export function roadPolylineShowsFlowLabel(
  mode: SandLogisticsEdgeLabelMode,
  flowM3: number,
  showFlowLabel: boolean,
): boolean {
  return mode !== 'hidden' && flowM3 > 0 && showFlowLabel;
}

/** В key-режиме: сначала короткие плечи — при dedupe остаются подписи у потребителей. */
export function sortPolylinesForKeyFlowLabels<T extends { nodeIds: string[]; points: { x: number; y: number }[] }>(
  polylines: T[],
  consumerSnaps: Set<string>,
): T[] {
  return [...polylines].sort((a, b) => {
    const aEnd = a.nodeIds[a.nodeIds.length - 1]!;
    const bEnd = b.nodeIds[b.nodeIds.length - 1]!;
    const aConsumerEnd = consumerSnaps.has(aEnd) ? 0 : 1;
    const bConsumerEnd = consumerSnaps.has(bEnd) ? 0 : 1;
    if (aConsumerEnd !== bConsumerEnd) return aConsumerEnd - bConsumerEnd;
    return a.points.length - b.points.length;
  });
}
