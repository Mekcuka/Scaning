import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  computeStableViewHalfExtent,
  localPlanCorners,
  localPlanEdgeMidpoints,
  rotationHandlePosition,
  SNAP_STEP_M,
  sketchFromCornerDrag,
  sketchFromEdgeDrag,
  sketchFromRotationDrag,
  envelopeOuterVertices,
  type EnvelopeWrapParams,
  type PlanEditTool,
  type PlanRectangleSketch,
} from '../../lib/padEarthworkSketch';

const VIEW_PAD = 1.35;

interface PlanRectangleEditorProps {
  sketch: PlanRectangleSketch;
  onChange: (sketch: PlanRectangleSketch) => void;
  tool?: PlanEditTool;
  snapEnabled?: boolean;
  lockAspect?: boolean;
  zoom?: number;
  fitViewNonce?: number;
  readOnly?: boolean;
  envelope?: EnvelopeWrapParams | null;
  showEdgeLengths?: boolean;
}

type DragKind = { type: 'corner'; index: number } | { type: 'edge'; index: number } | { type: 'rotate' };

export function PlanRectangleEditor({
  sketch,
  onChange,
  tool = 'corners',
  snapEnabled = true,
  lockAspect = false,
  zoom = 1,
  fitViewNonce = 0,
  readOnly = false,
  envelope = null,
  showEdgeLengths = true,
}: PlanRectangleEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const frozenHalfExtentRef = useRef<number | null>(null);
  const [drag, setDrag] = useState<DragKind | null>(null);
  const [stableHalfExtent, setStableHalfExtent] = useState(
    () => Math.max(sketch.length_m, sketch.width_m, 10) * VIEW_PAD,
  );

  const snapStep = snapEnabled ? SNAP_STEP_M : 0;
  const maxDim = Math.max(sketch.length_m, sketch.width_m, 10);
  const viewHalf = computeStableViewHalfExtent(
    stableHalfExtent,
    drag ? frozenHalfExtentRef.current : null,
    zoom,
  );
  const viewBox = `${-viewHalf} ${-viewHalf} ${viewHalf * 2} ${viewHalf * 2}`;

  const corners = useMemo(() => localPlanCorners(sketch), [sketch]);
  const edgeMids = useMemo(() => localPlanEdgeMidpoints(sketch), [sketch]);
  const rotHandle = useMemo(() => rotationHandlePosition(sketch), [sketch]);
  const polygonPoints = corners.map((c) => `${c.east_m},${-c.north_m}`).join(' ');
  const outerVertices =
    envelope?.enabled && envelope.wrap_width_m > 0
      ? envelopeOuterVertices(sketch, envelope.wrap_width_m)
      : null;
  const outerPoints = outerVertices?.map((v) => `${v.east_m},${-v.north_m}`).join(' ') ?? '';

  useEffect(() => {
    setStableHalfExtent(Math.max(sketch.length_m, sketch.width_m, 10) * VIEW_PAD);
  }, [fitViewNonce]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const blockWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener('wheel', blockWheel, { passive: false });
    return () => el.removeEventListener('wheel', blockWheel);
  }, []);

  const gridLines = useMemo(() => {
    if (!snapEnabled) return [];
    const step = SNAP_STEP_M;
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let v = -viewHalf; v <= viewHalf; v += step) {
      lines.push({ x1: -viewHalf, y1: -v, x2: viewHalf, y2: -v });
      lines.push({ x1: v, y1: -viewHalf, x2: v, y2: viewHalf });
    }
    return lines;
  }, [snapEnabled, viewHalf]);

  const clientToLocal = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const local = pt.matrixTransform(ctm.inverse());
    return { east_m: local.x, north_m: -local.y };
  }, []);

  const applyDrag = useCallback(
    (kind: DragKind, eastM: number, northM: number) => {
      const opts = { snapStep, lockAspect };
      if (kind.type === 'corner') {
        onChange(sketchFromCornerDrag(sketch, kind.index, eastM, northM, opts));
      } else if (kind.type === 'edge') {
        onChange(sketchFromEdgeDrag(sketch, kind.index, eastM, northM, { snapStep }));
      } else {
        onChange(sketchFromRotationDrag(sketch, eastM, northM, { snapStep }));
      }
    },
    [sketch, onChange, snapStep, lockAspect],
  );

  const onPointerDown =
    (kind: DragKind) => (e: React.PointerEvent) => {
      if (readOnly) return;
      e.preventDefault();
      e.stopPropagation();
      frozenHalfExtentRef.current = stableHalfExtent;
      setDrag(kind);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag || readOnly) return;
    const local = clientToLocal(e.clientX, e.clientY);
    if (!local) return;
    applyDrag(drag, local.east_m, local.north_m);
  };

  const onPointerUp = () => {
    if (drag) {
      frozenHalfExtentRef.current = null;
    }
    setDrag(null);
  };

  const handleRadius = Math.max(2.5, maxDim * 0.035);
  const edgeRadius = Math.max(2, maxDim * 0.028);
  const showCorners = tool === 'corners';
  const showEdges = tool === 'edges';
  const showRotate = tool === 'rotate';

  const dimFont = Math.max(2.5, maxDim * 0.04);

  return (
    <div ref={editorRef} className="pad-earthwork-sketch-editor">
      <svg
        ref={svgRef}
        className="pad-earthwork-sketch-editor__svg"
        viewBox={viewBox}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        role="img"
        aria-label="Схема площадки вид сверху"
      >
        {gridLines.map((g, i) => (
          <line
            key={i}
            x1={g.x1}
            y1={g.y1}
            x2={g.x2}
            y2={g.y2}
            className="pad-earthwork-sketch-editor__grid"
          />
        ))}
        <line x1={-viewHalf} y1={0} x2={viewHalf} y2={0} className="pad-earthwork-sketch-editor__axis" />
        <line x1={0} y1={-viewHalf} x2={0} y2={viewHalf} className="pad-earthwork-sketch-editor__axis" />
        <line
          x1={0}
          y1={0}
          x2={0}
          y2={-Math.min(viewHalf * 0.35, maxDim * 0.45)}
          className="pad-earthwork-sketch-editor__north"
          markerEnd="url(#pad-north-arrow)"
        />
        <polygon points={polygonPoints} className="pad-earthwork-sketch-editor__footprint" />
        {outerVertices && outerPoints && (
          <polygon
            points={outerPoints}
            className="pad-earthwork-sketch-editor__footprint pad-earthwork-sketch-editor__footprint--envelope"
          />
        )}
        <circle cx={0} cy={0} r={handleRadius * 0.45} className="pad-earthwork-sketch-editor__center" />

        {showEdgeLengths &&
          edgeMids.map((m, i) => (
            <g key={`edge-dim-${i}`}>
              <text
                x={m.east_m}
                y={-m.north_m - dimFont * 0.6}
                className="pad-earthwork-sketch-editor__edge-label"
                style={{ fontSize: dimFont }}
              >
                {i % 2 === 0
                  ? `${sketch.width_m.toFixed(0)} м`
                  : `${sketch.length_m.toFixed(0)} м`}
              </text>
            </g>
          ))}

        {showCorners &&
          corners.map((c, i) => (
            <circle
              key={`c-${i}`}
              cx={c.east_m}
              cy={-c.north_m}
              r={handleRadius}
              className="pad-earthwork-sketch-editor__handle pad-earthwork-sketch-editor__handle--corner"
              onPointerDown={onPointerDown({ type: 'corner', index: i })}
            />
          ))}

        {showEdges &&
          edgeMids.map((m, i) => (
            <rect
              key={`e-${i}`}
              x={m.east_m - edgeRadius}
              y={-m.north_m - edgeRadius}
              width={edgeRadius * 2}
              height={edgeRadius * 2}
              rx={edgeRadius * 0.3}
              className="pad-earthwork-sketch-editor__handle pad-earthwork-sketch-editor__handle--edge"
              onPointerDown={onPointerDown({ type: 'edge', index: i })}
            />
          ))}

        {showRotate && (
          <>
            <line
              x1={edgeMids[2].east_m}
              y1={-edgeMids[2].north_m}
              x2={rotHandle.east_m}
              y2={-rotHandle.north_m}
              className="pad-earthwork-sketch-editor__rot-arm"
            />
            <circle
              cx={rotHandle.east_m}
              cy={-rotHandle.north_m}
              r={handleRadius}
              className="pad-earthwork-sketch-editor__handle pad-earthwork-sketch-editor__handle--rotate"
              onPointerDown={onPointerDown({ type: 'rotate' })}
            />
          </>
        )}

        <defs>
          <marker
            id="pad-north-arrow"
            markerWidth="4"
            markerHeight="4"
            refX="2"
            refY="2"
            orient="auto"
          >
            <path d="M0,4 L2,0 L4,4 Z" className="pad-earthwork-sketch-editor__north-marker" />
          </marker>
        </defs>
      </svg>
      <p className="pad-earthwork-sketch-editor__hint text-xs">
        {tool === 'corners' && 'Перетащите углы. Центр — точка куста на карте.'}
        {tool === 'edges' && 'Перетащите середину стороны для изменения длины или ширины.'}
        {tool === 'rotate' && 'Перетащите маркер поворота вокруг центра.'}
        {snapEnabled && ' Привязка к сетке 1 м.'}
      </p>
    </div>
  );
}
