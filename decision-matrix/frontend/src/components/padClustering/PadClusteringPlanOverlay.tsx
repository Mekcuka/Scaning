import { useMemo } from 'react';
import { padFootprintVertices } from '../../lib/padEarthworkScene3d';
import { planSketchViewBoxForPoints } from '../../lib/planSketchViewport';
import type { PlanShapeSketch, PlanVertex } from '../../lib/padEarthworkSketch';

type PadClusteringPlanOverlayProps = {
  sketch: PlanShapeSketch;
  wellsLocal: PlanVertex[];
};

/** Read-only 2D plan (north up) — same ENU mapping as PlanPolygonEditor / earthwork sketch. */
export function PadClusteringPlanOverlay({ sketch, wellsLocal }: PadClusteringPlanOverlayProps) {
  const footprint = useMemo(() => padFootprintVertices(sketch), [sketch]);
  const viewBox = useMemo(
    () => planSketchViewBoxForPoints([...footprint, ...wellsLocal]),
    [footprint, wellsLocal],
  );

  if (footprint.length < 3) return null;

  const polyPoints = footprint.map((v) => `${v.east_m},${-v.north_m}`).join(' ');

  return (
    <div className="pad-clustering-plan-overlay" aria-hidden>
      <svg viewBox={viewBox} className="pad-clustering-plan-overlay__svg" preserveAspectRatio="xMidYMid meet">
        <polygon points={polyPoints} className="pad-clustering-plan-overlay__pad" />
        {wellsLocal.map((well, index) => (
          <circle
            key={`well-${index}`}
            cx={well.east_m}
            cy={-well.north_m}
            r={2.4}
            className="pad-clustering-plan-overlay__well"
          />
        ))}
        <g className="pad-clustering-plan-overlay__north">
          <line x1={0} y1={0} x2={0} y2={-14} />
          <polygon points="0,-16 -3,-11 3,-11" />
          <text x={4} y={-12}>
            N
          </text>
        </g>
      </svg>
      <span className="pad-clustering-plan-overlay__label">План (север ↑)</span>
    </div>
  );
}
