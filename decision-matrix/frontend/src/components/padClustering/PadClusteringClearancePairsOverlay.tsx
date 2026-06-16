import { useEffect, useState } from 'react';
import type { ClearancePair, WellTrajectory } from '../../lib/api/wellTrajectoryApi';
import {
  collectClearancePairApproaches,
  type ClearancePairApproach,
} from '../../lib/padClusteringScene3dClearance';
import { formatMinSf } from '../../lib/wellTrajectoryClearance';
import { worldToOverlayPx } from '../../lib/padScene3dProjection';
import type { SceneViewSnapshot } from './PadClusteringWellLabelsOverlay';
import * as THREE from 'three';

type LabelPlacement = {
  key: string;
  label: string;
  x: number;
  y: number;
  warning: boolean;
};

type PadClusteringClearancePairsOverlayProps = {
  trajectories: WellTrajectory[];
  clearancePairs: ClearancePair[];
  kbM: number;
  visible: boolean;
  getSceneView: () => SceneViewSnapshot;
};

function approachToLabel(item: ClearancePairApproach): string {
  return `SF ${formatMinSf(item.minSf)} · Скв-${item.wellA + 1}↔${item.wellB + 1}`;
}

export function PadClusteringClearancePairsOverlay({
  trajectories,
  clearancePairs,
  kbM,
  visible,
  getSceneView,
}: PadClusteringClearancePairsOverlayProps) {
  const [labels, setLabels] = useState<LabelPlacement[]>([]);

  useEffect(() => {
    if (!visible || clearancePairs.length === 0 || trajectories.length === 0) {
      setLabels([]);
      return undefined;
    }

    const approaches = collectClearancePairApproaches(trajectories, clearancePairs, kbM, {
      warningsOnly: true,
    });

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const view = getSceneView();
      if (!view) {
        setLabels([]);
        return;
      }

      const next: LabelPlacement[] = [];
      for (const item of approaches) {
        const world = new THREE.Vector3(item.midpoint.x, item.midpoint.y, item.midpoint.z);
        const px = worldToOverlayPx(view.camera, view.width, view.height, world);
        if (!px) continue;
        next.push({
          key: item.pairKey,
          label: approachToLabel(item),
          x: px.x,
          y: px.y,
          warning: item.warning,
        });
      }

      setLabels((prev) => {
        if (
          prev.length === next.length &&
          prev.every(
            (p, i) =>
              p.key === next[i]!.key &&
              Math.abs(p.x - next[i]!.x) < 0.5 &&
              Math.abs(p.y - next[i]!.y) < 0.5,
          )
        ) {
          return prev;
        }
        return next;
      });
    };

    tick();
    return () => cancelAnimationFrame(raf);
  }, [visible, trajectories, clearancePairs, kbM, getSceneView]);

  if (!visible || labels.length === 0) return null;

  return (
    <div className="pad-clustering-clearance-labels" aria-hidden>
      {labels.map((item) => (
        <span
          key={item.key}
          className={`pad-clustering-clearance-label${
            item.warning ? ' pad-clustering-clearance-label--warn' : ''
          }`}
          style={{ left: item.x, top: item.y }}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}
