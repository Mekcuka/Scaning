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
  envelopeBermCrestInnerVertices,
  envelopeBermCrestOuterVertices,
  envelopeBermSoleInnerVertices,
  type EnvelopeWrapParams,
  type PlanEditTool,
  type PlanRectangleSketch,
} from '../../lib/padEarthworkSketch';
import {
  buildPlanSketchViewBox,
  planSketchGridLines,
  type PlanSketchPan,
} from '../../lib/planSketchViewport';
import { DemPlanBackground } from './DemPlanBackground';
import type { PadDemPreview } from '../../lib/padEarthworkDemPreview';
import { envelopePlanInnerCrestSvgPath, envelopePlanRingSvgPath } from '../../lib/envelopePlan';
import { usePlanSketchViewport } from './usePlanSketchViewport';

const VIEW_PAD = 1.35;

interface PlanRectangleEditorProps {
  sketch: PlanRectangleSketch;
  onChange: (sketch: PlanRectangleSketch) => void;
  tool?: PlanEditTool;
  snapEnabled?: boolean;
  lockAspect?: boolean;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  viewPan?: PlanSketchPan;
  onViewPanChange?: (pan: PlanSketchPan) => void;
  fitViewNonce?: number;
  readOnly?: boolean;
  envelope?: EnvelopeWrapParams | null;
  showEdgeLengths?: boolean;
  showDemOverlay?: boolean;
  demPreview?: PadDemPreview | null;
  demPreviewLoading?: boolean;
}

type DragKind = { type: 'corner'; index: number } | { type: 'edge'; index: number } | { type: 'rotate' };

export function PlanRectangleEditor({
  sketch,
  onChange,
  tool = 'corners',
  snapEnabled = true,
  lockAspect = false,
  zoom = 1,
  onZoomChange,
  viewPan = { east_m: 0, north_m: 0 },
  onViewPanChange,
  fitViewNonce = 0,
  readOnly = false,
  envelope = null,
  showEdgeLengths = true,
  showDemOverlay = false,
  demPreview = null,
  demPreviewLoading = false,
}: PlanRectangleEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const canvasStackRef = useRef<HTMLDivElement>(null);
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
  const viewBox = buildPlanSketchViewBox(viewPan.east_m, viewPan.north_m, viewHalf);
  const visibleMinEast = viewPan.east_m - viewHalf;
  const visibleMaxEast = viewPan.east_m + viewHalf;
  const visibleMinNorth = viewPan.north_m - viewHalf;
  const visibleMaxNorth = viewPan.north_m + viewHalf;

  const handlePanChange = useCallback(
    (pan: PlanSketchPan) => {
      onViewPanChange?.(pan);
    },
    [onViewPanChange],
  );

  const handleZoomChange = useCallback(
    (nextZoom: number) => {
      onZoomChange?.(nextZoom);
    },
    [onZoomChange],
  );

  const { isPanning, onPanPointerDown, onPanPointerMove, onPanPointerUp, onPanPointerCancel } =
    usePlanSketchViewport({
      containerRef: canvasStackRef,
      svgRef,
      zoom,
      onZoomChange: handleZoomChange,
      pan: viewPan,
      onPanChange: handlePanChange,
      viewHalf,
    });

  const corners = useMemo(() => localPlanCorners(sketch), [sketch]);
  const edgeMids = useMemo(() => localPlanEdgeMidpoints(sketch), [sketch]);
  const rotHandle = useMemo(() => rotationHandlePosition(sketch), [sketch]);
  const polygonPoints = corners.map((c) => `${c.east_m},${-c.north_m}`).join(' ');
  const padVerts = corners.map((c) => ({ east_m: c.east_m, north_m: c.north_m }));
  const bermInnerVerts =
    envelope?.enabled && envelope.wrap_width_m > 0
      ? envelopeBermSoleInnerVertices(sketch, envelope.wrap_width_m)
      : null;
  const bermInnerCrestVerts =
    envelope?.enabled && envelope.wrap_width_m > 0
      ? envelopeBermCrestInnerVertices(sketch, envelope.wrap_width_m)
      : null;
  const bermOuterCrestVerts =
    envelope?.enabled && envelope.wrap_width_m > 0
      ? envelopeBermCrestOuterVertices(sketch, envelope.wrap_width_m)
      : null;
  const envelopeRingPath =
    bermInnerVerts && bermInnerVerts.length >= 3
      ? envelopePlanRingSvgPath(bermInnerVerts, padVerts)
      : '';
  const innerCrestPath =
    bermInnerCrestVerts && bermInnerCrestVerts.length >= 3
      ? envelopePlanInnerCrestSvgPath(bermInnerCrestVerts)
      : '';
  const outerCrestPath =
    bermOuterCrestVerts && bermOuterCrestVerts.length >= 3
      ? envelopePlanInnerCrestSvgPath(bermOuterCrestVerts)
      : '';

  useEffect(() => {
    setStableHalfExtent(Math.max(sketch.length_m, sketch.width_m, 10) * VIEW_PAD);
  }, [fitViewNonce, sketch.length_m, sketch.width_m]);

  const gridLines = useMemo(
    () => planSketchGridLines(viewPan.east_m, viewPan.north_m, viewHalf, snapStep),
    [viewHalf, viewPan.east_m, viewPan.north_m, snapStep],
  );

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
      <div
        ref={canvasStackRef}
        className={`pad-earthwork-sketch-editor__canvas-stack${isPanning ? ' pad-earthwork-sketch-editor__canvas-stack--panning' : ''}`}
        onPointerDown={onPanPointerDown}
        onPointerMove={onPanPointerMove}
        onPointerUp={onPanPointerUp}
        onPointerCancel={onPanPointerCancel}
      >
        {showDemOverlay && (
          <DemPlanBackground
            preview={demPreview}
            viewHalf={viewHalf}
            pan={viewPan}
            loading={demPreviewLoading}
          />
        )}
        <svg
          ref={svgRef}
          className={`pad-earthwork-sketch-editor__svg${showDemOverlay ? ' pad-earthwork-sketch-editor__svg--dem' : ''}`}
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
        <line
          x1={visibleMinEast}
          y1={0}
          x2={visibleMaxEast}
          y2={0}
          className="pad-earthwork-sketch-editor__axis"
        />
        <line
          x1={0}
          y1={-visibleMaxNorth}
          x2={0}
          y2={-visibleMinNorth}
          className="pad-earthwork-sketch-editor__axis"
        />
        <line
          x1={0}
          y1={0}
          x2={0}
          y2={-Math.min(viewHalf * 0.35, maxDim * 0.45)}
          className="pad-earthwork-sketch-editor__north"
          markerEnd="url(#pad-north-arrow)"
        />
        <polygon points={polygonPoints} className="pad-earthwork-sketch-editor__footprint" />
        {envelopeRingPath && (
          <path
            d={envelopeRingPath}
            fillRule="evenodd"
            className="pad-earthwork-sketch-editor__footprint--envelope-ring"
          />
        )}
        {outerCrestPath && (
          <path
            d={outerCrestPath}
            className="pad-earthwork-sketch-editor__footprint--envelope-outer-crest"
          />
        )}
        {innerCrestPath && (
          <path
            d={innerCrestPath}
            className="pad-earthwork-sketch-editor__footprint--envelope-inner-crest"
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
      </div>
      <p className="pad-earthwork-sketch-editor__hint text-xs">
        {tool === 'corners' && 'Перетащите углы. Центр — точка куста на карте.'}
        {tool === 'edges' && 'Перетащите середину стороны для изменения длины или ширины.'}
        {tool === 'rotate' && 'Перетащите маркер поворота вокруг центра.'}
        {snapEnabled && ' Привязка к сетке 1 м.'}
        {' Колёсико — масштаб; средняя кнопка или Space+перетаскивание — перемещение.'}
        {envelopeRingPath &&
          ' Оранжевое кольцо — подошва обваловки (W) на верху насыпи; пунктир — внешняя и внутренняя бровка.'}
      </p>
    </div>
  );
}
