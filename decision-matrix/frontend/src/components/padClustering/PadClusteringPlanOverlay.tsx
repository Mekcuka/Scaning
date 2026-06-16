import { useId, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { padFootprintVertices } from '../../lib/padEarthworkScene3d';
import { planSketchViewBoxForPoints } from '../../lib/planSketchViewport';
import type { PlanShapeSketch, PlanVertex } from '../../lib/padEarthworkSketch';

type PadClusteringPlanOverlayProps = {
  sketch: PlanShapeSketch;
  wellsLocal: PlanVertex[];
  defaultOpen?: boolean;
};

/** Read-only 2D plan (north up) — same ENU mapping as PlanPolygonEditor / earthwork sketch. */
export function PadClusteringPlanOverlay({
  sketch,
  wellsLocal,
  defaultOpen = true,
}: PadClusteringPlanOverlayProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const footprint = useMemo(() => padFootprintVertices(sketch), [sketch]);
  const viewBox = useMemo(
    () => planSketchViewBoxForPoints([...footprint, ...wellsLocal]),
    [footprint, wellsLocal],
  );

  if (footprint.length < 3) return null;

  const polyPoints = footprint.map((v) => `${v.east_m},${-v.north_m}`).join(' ');

  return (
    <div
      className={`pad-clustering-plan-overlay${open ? '' : ' pad-clustering-plan-overlay--collapsed'}`}
    >
      <button
        type="button"
        className="pad-clustering-plan-overlay__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        title={open ? 'Свернуть план куста' : 'Развернуть план куста'}
      >
        <span className="pad-clustering-plan-overlay__label">План (север ↑)</span>
        <ChevronDown
          size={14}
          aria-hidden
          className={`pad-clustering-plan-overlay__chevron${open ? ' pad-clustering-plan-overlay__chevron--open' : ''}`}
        />
      </button>
      {open ? (
        <div id={panelId} className="pad-clustering-plan-overlay__body">
          <svg
            viewBox={viewBox}
            className="pad-clustering-plan-overlay__svg"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden
          >
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
        </div>
      ) : null}
    </div>
  );
}
