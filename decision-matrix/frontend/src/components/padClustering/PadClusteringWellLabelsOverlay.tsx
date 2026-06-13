import { useEffect, useState } from 'react';
import type * as THREE from 'three';
import type { WellTrajectory } from '../../lib/api/wellTrajectoryApi';
import { clusteringWellLabel } from '../../lib/padClusteringScene3dLayers';
import type { PlanVertex } from '../../lib/padEarthworkSketch';
import { planWellheadWorldPosition, worldToOverlayPx } from '../../lib/padScene3dProjection';

export type SceneViewSnapshot = {
  camera: THREE.Camera;
  width: number;
  height: number;
} | null;

type LabelPlacement = {
  index: number;
  label: string;
  x: number;
  y: number;
  selected: boolean;
};

type PadClusteringWellLabelsOverlayProps = {
  wellsLocal: PlanVertex[];
  trajectories: WellTrajectory[];
  kbM: number;
  selectedWellIndex: number | null;
  visible: boolean;
  getSceneView: () => SceneViewSnapshot;
};

export function PadClusteringWellLabelsOverlay({
  wellsLocal,
  trajectories,
  kbM,
  selectedWellIndex,
  visible,
  getSceneView,
}: PadClusteringWellLabelsOverlayProps) {
  const [labels, setLabels] = useState<LabelPlacement[]>([]);

  useEffect(() => {
    if (!visible || wellsLocal.length === 0) {
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
      for (let index = 0; index < wellsLocal.length; index += 1) {
        const well = wellsLocal[index]!;
        const traj = trajectories.find((t) => (t.well_index ?? -1) === index);
        const world = planWellheadWorldPosition(well.east_m, well.north_m, kbM);
        const px = worldToOverlayPx(view.camera, view.width, view.height, world);
        if (!px) continue;
        next.push({
          index,
          label: clusteringWellLabel(index, traj?.name),
          x: px.x,
          y: px.y,
          selected: selectedWellIndex === index,
        });
      }
      setLabels((prev) => {
        if (
          prev.length === next.length &&
          prev.every(
            (p, i) =>
              p.index === next[i]!.index &&
              Math.abs(p.x - next[i]!.x) < 0.5 &&
              Math.abs(p.y - next[i]!.y) < 0.5 &&
              p.selected === next[i]!.selected,
          )
        ) {
          return prev;
        }
        return next;
      });
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [visible, wellsLocal, trajectories, kbM, selectedWellIndex, getSceneView]);

  if (!visible || labels.length === 0) return null;

  return (
    <div className="pad-clustering-well-labels" aria-hidden>
      {labels.map((item) => (
        <span
          key={item.index}
          className={`pad-clustering-well-label${
            item.selected ? ' pad-clustering-well-label--selected' : ''
          }`}
          style={{ left: item.x, top: item.y }}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}
