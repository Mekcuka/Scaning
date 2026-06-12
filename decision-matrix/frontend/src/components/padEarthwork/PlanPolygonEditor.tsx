import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addPolygonVertex,
  computeStableViewHalfExtent,
  resolvePlanAxisDrag,
  EDGE_HIT_PX,
  envelopeBermCrestInnerVertices,
  envelopeBermCrestOuterVertices,
  envelopeBermSoleInnerVertices,
  insertPolygonVertexOnEdge,
  isPolygonSketchClosed,
  metersPerScreenPixel,
  movePolygonEdgeFromDrag,
  movePolygonVertex,
  nearestPolygonEdgePx,
  formatPlanEdgeLengthM,
  polygonEdgeLabels,
  polygonFootprintAreaM2,
  polygonPerimeterM,
  polygonVertexRightAngleGuides,
  polygonViewBboxHalfExtent,
  removePolygonVertex,
  SNAP_STEP_M,
  VIEW_PAD_CONSTANT,
  type EnvelopeWrapParams,
  type PlanAxisConstraint,
  type PlanPolygonSketch,
  type PlanVertex,
  type PolygonEditTool,
} from '../../lib/padEarthworkSketch';
import {
  buildPlanSketchViewBox,
  planSketchGridLines,
  type PlanSketchPan,
} from '../../lib/planSketchViewport';
import { DemPlanBackground } from './DemPlanBackground';
import { envelopePlanInnerCrestSvgPath, envelopePlanRingSvgPath } from '../../lib/envelopePlan';
import type { PadDemPreview } from '../../lib/padEarthworkDemPreview';
import { usePlanSketchViewport } from './usePlanSketchViewport';

interface PlanPolygonEditorProps {
  sketch: PlanPolygonSketch;
  onChange: (sketch: PlanPolygonSketch) => void;
  tool?: PolygonEditTool;
  snapEnabled?: boolean;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  viewPan?: PlanSketchPan;
  onViewPanChange?: (pan: PlanSketchPan) => void;
  fitViewNonce?: number;
  readOnly?: boolean;
  envelope?: EnvelopeWrapParams | null;
  showEdgeLengths?: boolean;
  wellsLocal?: PlanVertex[];
  showDemOverlay?: boolean;
  demPreview?: PadDemPreview | null;
  demPreviewLoading?: boolean;
}

type DragState =
  | {
      type: 'vertex';
      index: number;
      pointerStartEast: number;
      pointerStartNorth: number;
    }
  | {
      type: 'edge';
      edgeIndex: number;
      pointerStartEast: number;
      pointerStartNorth: number;
      edgeStartA: { east_m: number; north_m: number };
      edgeStartB: { east_m: number; north_m: number };
    };

export function PlanPolygonEditor({
  sketch,
  onChange,
  tool = 'vertices',
  snapEnabled = true,
  zoom = 1,
  onZoomChange,
  viewPan = { east_m: 0, north_m: 0 },
  onViewPanChange,
  fitViewNonce = 0,
  readOnly = false,
  envelope = null,
  showEdgeLengths = false,
  wellsLocal = [],
  showDemOverlay = false,
  demPreview = null,
  demPreviewLoading = false,
}: PlanPolygonEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const canvasStackRef = useRef<HTMLDivElement>(null);
  const frozenHalfExtentRef = useRef<number | null>(null);
  const axisConstraintRef = useRef<PlanAxisConstraint | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [cursor, setCursor] = useState<{ east_m: number; north_m: number } | null>(null);
  const [stableHalfExtent, setStableHalfExtent] = useState(() =>
    polygonViewBboxHalfExtent(sketch) * VIEW_PAD_CONSTANT,
  );

  const snapStep = snapEnabled ? SNAP_STEP_M : 0;
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

  const polygonPoints = sketch.vertices.map((v) => `${v.east_m},${-v.north_m}`).join(' ');
  const closed = isPolygonSketchClosed(sketch);
  const area = closed ? polygonFootprintAreaM2(sketch) : 0;
  const perimeter = sketch.vertices.length >= 2 ? polygonPerimeterM(sketch.vertices) : 0;

  const bermInnerVerts =
    envelope?.enabled && closed && envelope.wrap_width_m > 0
      ? envelopeBermSoleInnerVertices(sketch, envelope.wrap_width_m)
      : null;
  const bermInnerCrestVerts =
    envelope?.enabled && closed && envelope.wrap_width_m > 0
      ? envelopeBermCrestInnerVertices(sketch, envelope.wrap_width_m)
      : null;
  const bermOuterCrestVerts =
    envelope?.enabled && closed && envelope.wrap_width_m > 0
      ? envelopeBermCrestOuterVertices(sketch, envelope.wrap_width_m)
      : null;
  const envelopeRingPath =
    bermInnerVerts && closed
      ? envelopePlanRingSvgPath(bermInnerVerts, sketch.vertices)
      : '';
  const innerCrestPath =
    bermInnerCrestVerts && closed ? envelopePlanInnerCrestSvgPath(bermInnerCrestVerts) : '';
  const outerCrestPath =
    bermOuterCrestVerts && closed ? envelopePlanInnerCrestSvgPath(bermOuterCrestVerts) : '';
  const previewPoints =
    cursor && sketch.vertices.length > 0 && tool === 'draw'
      ? [...sketch.vertices.map((v) => `${v.east_m},${-v.north_m}`), `${cursor.east_m},${-cursor.north_m}`].join(' ')
      : polygonPoints;

  useEffect(() => {
    setStableHalfExtent(polygonViewBboxHalfExtent(sketch) * VIEW_PAD_CONSTANT);
  }, [fitViewNonce]);

  const gridLines = useMemo(
    () => planSketchGridLines(viewPan.east_m, viewPan.north_m, viewHalf, snapStep),
    [snapEnabled, viewHalf, viewPan.east_m, viewPan.north_m, snapStep],
  );

  const handleRadius = Math.max(2.5, stableHalfExtent * 0.026);
  const dimFont = Math.max(2.5, stableHalfExtent * 0.03);
  const edgeLabels = useMemo(
    () =>
      polygonEdgeLabels(sketch.vertices, {
        closed,
        labelOffsetM: dimFont * 0.55,
      }),
    [sketch.vertices, closed, dimFont],
  );
  const rightAngleGuides = useMemo(() => {
    if (!drag || drag.type !== 'vertex') return [];
    return polygonVertexRightAngleGuides(sketch.vertices, drag.index, viewHalf, { closed });
  }, [drag, sketch.vertices, viewHalf, closed]);

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

  const tryInsertOnEdge = useCallback(
    (clientX: number, clientY: number) => {
      if (!closed || readOnly) return false;
      const local = clientToLocal(clientX, clientY);
      const svg = svgRef.current;
      if (!local || !svg) return false;
      const mpp = metersPerScreenPixel(svg);
      const nearest = nearestPolygonEdgePx(sketch, local.east_m, local.north_m, EDGE_HIT_PX, mpp);
      if (!nearest) return false;
      onChange(
        insertPolygonVertexOnEdge(sketch, nearest.edgeIndex, nearest.east_m, nearest.north_m, {
          snapStep,
        }),
      );
      return true;
    },
    [closed, readOnly, clientToLocal, sketch, onChange, snapStep],
  );

  const onCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (readOnly || e.detail === 0) return;
    const local = clientToLocal(e.clientX, e.clientY);
    if (!local) return;

    if (tool === 'draw') {
      onChange(addPolygonVertex(sketch, local.east_m, local.north_m, { snapStep }));
      return;
    }
    if (tool === 'insert') {
      tryInsertOnEdge(e.clientX, e.clientY);
    }
  };

  const onPointerDownVertex = (index: number) => (e: React.PointerEvent) => {
    if (readOnly || tool !== 'vertices') return;
    e.preventDefault();
    e.stopPropagation();
    const local = clientToLocal(e.clientX, e.clientY);
    const vertex = sketch.vertices[index];
    frozenHalfExtentRef.current = stableHalfExtent;
    axisConstraintRef.current = null;
    setDrag({
      type: 'vertex',
      index,
      pointerStartEast: local?.east_m ?? vertex.east_m,
      pointerStartNorth: local?.north_m ?? vertex.north_m,
    });
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onEraseVertex = (index: number) => (e: React.PointerEvent) => {
    if (readOnly || tool !== 'erase') return;
    e.preventDefault();
    e.stopPropagation();
    onChange(removePolygonVertex(sketch, index));
  };

  const onEdgePointerDown = (edgeIndex: number) => (e: React.PointerEvent) => {
    if (readOnly || tool !== 'vertices') return;
    e.preventDefault();
    e.stopPropagation();
    const local = clientToLocal(e.clientX, e.clientY);
    if (!local) return;
    const nextIndex = (edgeIndex + 1) % sketch.vertices.length;
    frozenHalfExtentRef.current = stableHalfExtent;
    axisConstraintRef.current = null;
    setDrag({
      type: 'edge',
      edgeIndex,
      pointerStartEast: local.east_m,
      pointerStartNorth: local.north_m,
      edgeStartA: { ...sketch.vertices[edgeIndex] },
      edgeStartB: { ...sketch.vertices[nextIndex] },
    });
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const local = clientToLocal(e.clientX, e.clientY);
    if (local && tool === 'draw' && !readOnly) setCursor(local);
    if (!drag || readOnly || !local) return;

    const constrained = resolvePlanAxisDrag(
      local.east_m,
      local.north_m,
      drag.pointerStartEast,
      drag.pointerStartNorth,
      e.altKey,
      axisConstraintRef.current,
    );
    axisConstraintRef.current = constrained.constraint;

    if (drag.type === 'vertex') {
      onChange(
        movePolygonVertex(sketch, drag.index, constrained.east_m, constrained.north_m, { snapStep }),
      );
    } else if (drag.type === 'edge') {
      onChange(
        movePolygonEdgeFromDrag(
          sketch,
          drag.edgeIndex,
          constrained.east_m,
          constrained.north_m,
          drag.pointerStartEast,
          drag.pointerStartNorth,
          drag.edgeStartA,
          drag.edgeStartB,
          { snapStep },
        ),
      );
    }
  };

  const onPointerUp = () => {
    if (drag) {
      frozenHalfExtentRef.current = null;
    }
    axisConstraintRef.current = null;
    setDrag(null);
  };

  const hint =
    tool === 'draw'
      ? 'Кликайте по холсту, чтобы добавить вершины контура (минимум 3).'
      : tool === 'vertices'
        ? 'Перетаскивайте вершины или стороны контура. Alt — только по оси E или N. При угле 90° — направляющие. Центр — точка куста.'
        : tool === 'insert'
          ? 'Кликните на сторону контура (или по пунктирной линии), чтобы добавить вершину.'
          : 'Кликните по вершине, чтобы удалить её (не менее 3 вершин).';

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
          className={`pad-earthwork-sketch-editor__svg${tool === 'draw' ? ' pad-earthwork-sketch-editor__svg--crosshair' : ''}${tool === 'erase' ? ' pad-earthwork-sketch-editor__svg--erase' : ''}${tool === 'insert' ? ' pad-earthwork-sketch-editor__svg--insert' : ''}${tool === 'vertices' ? ' pad-earthwork-sketch-editor__svg--vertices' : ''}${showDemOverlay ? ' pad-earthwork-sketch-editor__svg--dem' : ''}`}
        viewBox={viewBox}
        onClick={onCanvasClick}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          onPointerUp();
          setCursor(null);
        }}
        role="img"
        aria-label="Произвольный контур площадки"
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
          y2={-Math.min(viewHalf * 0.35, stableHalfExtent * 0.35)}
          className="pad-earthwork-sketch-editor__north"
          markerEnd="url(#pad-polygon-north-arrow)"
        />

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

        {sketch.vertices.length >= 2 && (
          <polyline
            points={tool === 'draw' && cursor ? previewPoints : polygonPoints}
            className={`pad-earthwork-sketch-editor__polyline${closed ? ' pad-earthwork-sketch-editor__polyline--closed' : ''}`}
            fill={closed ? undefined : 'none'}
          />
        )}

        {closed && (
          <polygon
            points={polygonPoints}
            className="pad-earthwork-sketch-editor__footprint pad-earthwork-sketch-editor__footprint--polygon"
          />
        )}

        {(tool === 'insert' || tool === 'vertices') &&
          closed &&
          sketch.vertices.map((v, i) => {
            const next = sketch.vertices[(i + 1) % sketch.vertices.length];
            return (
              <line
                key={`edge-hit-${i}`}
                x1={v.east_m}
                y1={-v.north_m}
                x2={next.east_m}
                y2={-next.north_m}
                className={`pad-earthwork-sketch-editor__edge-hit${tool === 'vertices' ? ' pad-earthwork-sketch-editor__edge-hit--drag' : ''}`}
                onPointerDown={tool === 'vertices' ? onEdgePointerDown(i) : undefined}
              />
            );
          })}

        {rightAngleGuides.map((guide, i) => (
          <line
            key={`right-angle-guide-${i}`}
            x1={guide.east_m}
            y1={-guide.north_m}
            x2={guide.east2_m}
            y2={-guide.north2_m}
            className="pad-earthwork-sketch-editor__right-angle-guide"
          />
        ))}

        {showEdgeLengths &&
          edgeLabels.map((edge, i) => (
            <text
              key={`edge-label-${i}`}
              x={edge.east_m}
              y={-edge.north_m}
              className="pad-earthwork-sketch-editor__edge-label"
              style={{ fontSize: dimFont * 0.9 }}
            >
              {formatPlanEdgeLengthM(edge.length_m)} м
            </text>
          ))}

        {closed && area > 0 && (
          <text x={0} y={dimFont} className="pad-earthwork-sketch-editor__area-label" style={{ fontSize: dimFont }}>
            {area.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} м²
          </text>
        )}

        <circle cx={0} cy={0} r={handleRadius * 0.45} className="pad-earthwork-sketch-editor__center" />

        {wellsLocal.map((well, i) => (
          <g key={`well-${i}`}>
            <circle
              cx={well.east_m}
              cy={-well.north_m}
              r={handleRadius * 0.75}
              className="pad-earthwork-sketch-editor__well"
            />
            <text
              x={well.east_m}
              y={-well.north_m + dimFont * 0.35}
              className="pad-earthwork-sketch-editor__well-label"
              style={{ fontSize: dimFont * 0.75 }}
            >
              {i + 1}
            </text>
          </g>
        ))}

        {sketch.vertices.map((v, i) => (
          <g key={`v-${i}`}>
            <circle
              cx={v.east_m}
              cy={-v.north_m}
              r={handleRadius}
              className={`pad-earthwork-sketch-editor__handle pad-earthwork-sketch-editor__handle--vertex${tool === 'erase' ? ' pad-earthwork-sketch-editor__handle--erase-target' : ''}`}
              onPointerDown={
                tool === 'vertices'
                  ? onPointerDownVertex(i)
                  : tool === 'erase'
                    ? onEraseVertex(i)
                    : undefined
              }
            />
            {(tool === 'vertices' || tool === 'erase') && (
              <text
                x={v.east_m}
                y={-v.north_m - handleRadius * 1.2}
                className="pad-earthwork-sketch-editor__vertex-label"
                style={{ fontSize: dimFont * 0.85 }}
              >
                {i + 1}
              </text>
            )}
          </g>
        ))}

        {tool === 'draw' && cursor && sketch.vertices.length > 0 && (
          <line
            x1={sketch.vertices[sketch.vertices.length - 1].east_m}
            y1={-sketch.vertices[sketch.vertices.length - 1].north_m}
            x2={cursor.east_m}
            y2={-cursor.north_m}
            className="pad-earthwork-sketch-editor__preview-line"
          />
        )}

        <defs>
          <marker
            id="pad-polygon-north-arrow"
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
        {hint}
        {snapEnabled && ' Привязка к сетке 1 м.'}
        {' Колёсико — масштаб; средняя кнопка или Space+перетаскивание — перемещение.'}
        {closed && perimeter > 0 && ` Периметр: ${perimeter.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} м.`}
        {envelopeRingPath &&
          ' Оранжевое кольцо — подошва обваловки (W) на верху насыпи; пунктир — внешняя и внутренняя бровка.'}
      </p>
    </div>
  );
}

export default PlanPolygonEditor;