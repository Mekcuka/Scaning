import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { metersPerScreenPixel } from '../../lib/padEarthworkSketch';
import {
  clampPlanSketchZoom,
  clientToPlanSketchLocal,
  PLAN_SKETCH_WHEEL_ZOOM_FACTOR,
  type PlanSketchPan,
  zoomPlanSketchAtWorldPoint,
} from '../../lib/planSketchViewport';

type PanDragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPanEast: number;
  startPanNorth: number;
};

export function usePlanSketchViewport(options: {
  containerRef: RefObject<HTMLElement | null>;
  svgRef: RefObject<SVGSVGElement | null>;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  pan: PlanSketchPan;
  onPanChange: (pan: PlanSketchPan) => void;
  viewHalf: number;
}) {
  const { containerRef, svgRef, zoom, onZoomChange, pan, onPanChange, viewHalf } = options;
  const panDragRef = useRef<PanDragState | null>(null);
  const spacePressedRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        spacePressedRef.current = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spacePressedRef.current = false;
        setIsPanning(false);
      }
    };
    const onBlur = () => {
      spacePressedRef.current = false;
      setIsPanning(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const svg = svgRef.current;
      if (!svg) return;
      const local = clientToPlanSketchLocal(svg, e.clientX, e.clientY);
      if (!local) return;
      const factor = e.deltaY < 0 ? PLAN_SKETCH_WHEEL_ZOOM_FACTOR : 1 / PLAN_SKETCH_WHEEL_ZOOM_FACTOR;
      const next = zoomPlanSketchAtWorldPoint(
        zoom,
        viewHalf,
        pan,
        local.east_m,
        local.north_m,
        factor,
      );
      if (next.zoom !== zoom) onZoomChange(next.zoom);
      if (next.pan.east_m !== pan.east_m || next.pan.north_m !== pan.north_m) {
        onPanChange(next.pan);
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [containerRef, svgRef, zoom, viewHalf, pan, onZoomChange, onPanChange]);

  const canStartPan = useCallback((e: React.PointerEvent) => {
    return e.button === 1 || (e.button === 0 && spacePressedRef.current);
  }, []);

  const onPanPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!canStartPan(e)) return;
      e.preventDefault();
      e.stopPropagation();
      panDragRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanEast: pan.east_m,
        startPanNorth: pan.north_m,
      };
      setIsPanning(true);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    },
    [canStartPan, pan.east_m, pan.north_m],
  );

  const onPanPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = panDragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const svg = svgRef.current;
      if (!svg) return;
      const mpp = metersPerScreenPixel(svg);
      const dx = e.clientX - drag.startClientX;
      const dy = e.clientY - drag.startClientY;
      onPanChange({
        east_m: drag.startPanEast - dx * mpp,
        north_m: drag.startPanNorth + dy * mpp,
      });
    },
    [svgRef, onPanChange],
  );

  const onPanPointerUp = useCallback((e: React.PointerEvent) => {
    const drag = panDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    panDragRef.current = null;
    setIsPanning(false);
  }, []);

  return {
    isPanning,
    spacePressedRef,
    onPanPointerDown,
    onPanPointerMove,
    onPanPointerUp,
    onPanPointerCancel: onPanPointerUp,
  };
}

export { clampPlanSketchZoom };
