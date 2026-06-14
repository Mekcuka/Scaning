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
  type PlanAxisConstraint,
} from '../../lib/padEarthworkSketch';
import {
  buildPlanSketchViewBox,
  planSketchGridLines,
} from '../../lib/planSketchViewport';
import { envelopePlanInnerCrestSvgPath, envelopePlanRingSvgPath } from '../../lib/envelopePlan';
import { usePlanSketchViewport } from './usePlanSketchViewport';
import type { PlanPolygonEditorProps, PolygonDragState } from './planPolygonEditorTypes';

export function usePlanPolygonEditor({
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
}: PlanPolygonEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const canvasStackRef = useRef<HTMLDivElement>(null);
  const frozenHalfExtentRef = useRef<number | null>(null);
  const axisConstraintRef = useRef<PlanAxisConstraint | null>(null);
  const [drag, setDrag] = useState<PolygonDragState | null>(null);
  const [cursor, setCursor] = useState<{ east_m: number; north_m: number } | null>(null);
  const [stableHalfExtent, setStableHalfExtent] = useState(
    () => polygonViewBboxHalfExtent(sketch) * VIEW_PAD_CONSTANT,
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
    (pan: { east_m: number; north_m: number }) => {
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
    bermInnerVerts && closed ? envelopePlanRingSvgPath(bermInnerVerts, sketch.vertices) : '';
  const innerCrestPath =
    bermInnerCrestVerts && closed ? envelopePlanInnerCrestSvgPath(bermInnerCrestVerts) : '';
  const outerCrestPath =
    bermOuterCrestVerts && closed ? envelopePlanInnerCrestSvgPath(bermOuterCrestVerts) : '';
  const previewPoints =
    cursor && sketch.vertices.length > 0 && tool === 'draw'
      ? [
          ...sketch.vertices.map((v) => `${v.east_m},${-v.north_m}`),
          `${cursor.east_m},${-cursor.north_m}`,
        ].join(' ')
      : polygonPoints;

  useEffect(() => {
    setStableHalfExtent(polygonViewBboxHalfExtent(sketch) * VIEW_PAD_CONSTANT);
  }, [fitViewNonce, sketch]);

  const gridLines = useMemo(
    () => planSketchGridLines(viewPan.east_m, viewPan.north_m, viewHalf, snapStep),
    [viewHalf, viewPan.east_m, viewPan.north_m, snapStep],
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

  const onPointerLeave = () => {
    onPointerUp();
    setCursor(null);
  };

  const hint =
    tool === 'draw'
      ? 'Кликайте по холсту, чтобы добавить вершины контура (минимум 3).'
      : tool === 'vertices'
        ? 'Перетаскивайте вершины или стороны контура. Alt — только по оси E или N. При угле 90° — направляющие. Центр — точка куста.'
        : tool === 'insert'
          ? 'Кликните на сторону контура (или по пунктирной линии), чтобы добавить вершину.'
          : 'Кликните по вершине, чтобы удалить её (не менее 3 вершин).';

  const svgClassName = [
    'pad-earthwork-sketch-editor__svg',
    tool === 'draw' ? ' pad-earthwork-sketch-editor__svg--crosshair' : '',
    tool === 'erase' ? ' pad-earthwork-sketch-editor__svg--erase' : '',
    tool === 'insert' ? ' pad-earthwork-sketch-editor__svg--insert' : '',
    tool === 'vertices' ? ' pad-earthwork-sketch-editor__svg--vertices' : '',
  ].join('');

  return {
    editorRef,
    canvasStackRef,
    svgRef,
    isPanning,
    onPanPointerDown,
    onPanPointerMove,
    onPanPointerUp,
    onPanPointerCancel,
    viewBox,
    visibleMinEast,
    visibleMaxEast,
    visibleMinNorth,
    visibleMaxNorth,
    gridLines,
    stableHalfExtent,
    viewHalf,
    polygonPoints,
    closed,
    area,
    perimeter,
    envelopeRingPath,
    innerCrestPath,
    outerCrestPath,
    previewPoints,
    handleRadius,
    dimFont,
    edgeLabels,
    rightAngleGuides,
    cursor,
    tool,
    sketch,
    showEdgeLengths,
    formatPlanEdgeLengthM,
    onCanvasClick,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    onPointerDownVertex,
    onEraseVertex,
    onEdgePointerDown,
    hint,
    snapEnabled,
    svgClassName,
  };
}

export type PlanPolygonEditorView = ReturnType<typeof usePlanPolygonEditor>;
