import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { InfraObject } from '../../lib/api';
import type { WellTrajectory } from '../../lib/api/wellTrajectoryApi';
import { collectBottomholeLabelAnchors, stationToScenePoint } from '../../lib/padClusteringScene3d';
import { worldToOverlayPx } from '../../lib/padScene3dProjection';
import type { SceneViewSnapshot } from './PadClusteringWellLabelsOverlay';

type LabelPlacement = {
  id: string;
  label: string;
  x: number;
  y: number;
  gsRole?: 'heel' | 'toe';
};

type PadClusteringBottomholeLabelsOverlayProps = {
  bottomholes: InfraObject[];
  trajectories: WellTrajectory[];
  padLon: number;
  padLat: number;
  kbM: number;
  visible: boolean;
  getSceneView: () => SceneViewSnapshot;
};

export function PadClusteringBottomholeLabelsOverlay({
  bottomholes,
  trajectories,
  padLon,
  padLat,
  kbM,
  visible,
  getSceneView,
}: PadClusteringBottomholeLabelsOverlayProps) {
  const anchors = useMemo(
    () => collectBottomholeLabelAnchors(bottomholes, trajectories, padLon, padLat),
    [bottomholes, trajectories, padLon, padLat],
  );
  const [labels, setLabels] = useState<LabelPlacement[]>([]);

  useEffect(() => {
    if (!visible || anchors.length === 0) {
      setLabels([]);
      return undefined;
    }

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const view = getSceneView();
      if (!view) {
        setLabels([]);
        return;
      }
      const next: LabelPlacement[] = [];
      for (const anchor of anchors) {
        const scene = stationToScenePoint(anchor.eastM, anchor.northM, anchor.tvdM, kbM);
        const world = new THREE.Vector3(scene.x, scene.y, scene.z);
        const px = worldToOverlayPx(view.camera, view.width, view.height, world);
        if (!px) continue;
        next.push({
          id: anchor.id,
          label: anchor.label,
          x: px.x,
          y: px.y,
          gsRole: anchor.gsRole,
        });
      }
      setLabels((prev) => {
        if (
          prev.length === next.length &&
          prev.every(
            (p, i) =>
              p.id === next[i]!.id &&
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
  }, [visible, anchors, kbM, getSceneView]);

  if (!visible || labels.length === 0) return null;

  return (
    <div className="pad-clustering-bottomhole-labels" aria-hidden>
      {labels.map((item) => (
        <span
          key={item.id}
          className={`pad-clustering-bottomhole-label${
            item.gsRole === 'heel'
              ? ' pad-clustering-bottomhole-label--heel'
              : item.gsRole === 'toe'
                ? ' pad-clustering-bottomhole-label--toe'
                : ''
          }`}
          style={{ left: item.x, top: item.y }}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}
