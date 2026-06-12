import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { metersPerScreenPixel } from '../../lib/padEarthworkSketch';
import {
  clampProfileSketchZoom,
  clientToProfileLocal,
  PROFILE_SKETCH_WHEEL_ZOOM_FACTOR,
  type ProfileSketchPan,
  zoomProfileAtWorldPoint,
} from '../../lib/profileSketchViewport';

type PanDragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPanChainage: number;
  startPanElevation: number;
};

export function useProfileSketchViewport(options: {
  containerRef: RefObject<HTMLElement | null>;
  svgRef: RefObject<SVGSVGElement | null>;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  pan: ProfileSketchPan;
  onPanChange: (pan: ProfileSketchPan) => void;
  viewHalfChainage: number;
  viewHalfElevation: number;
}) {
  const {
    containerRef,
    svgRef,
    zoom,
    onZoomChange,
    pan,
    onPanChange,
    viewHalfChainage,
    viewHalfElevation,
  } = options;
  const panDragRef = useRef<PanDragState | null>(null);
  const spacePressedRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) spacePressedRef.current = true;
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
      const local = clientToProfileLocal(svg, e.clientX, e.clientY);
      if (!local) return;
      const factor =
        e.deltaY < 0 ? PROFILE_SKETCH_WHEEL_ZOOM_FACTOR : 1 / PROFILE_SKETCH_WHEEL_ZOOM_FACTOR;
      const next = zoomProfileAtWorldPoint(
        zoom,
        viewHalfChainage,
        viewHalfElevation,
        pan,
        local.chainage_m,
        local.elevation_m,
        factor,
      );
      if (next.zoom !== zoom) onZoomChange(next.zoom);
      if (
        next.pan.chainage_m !== pan.chainage_m ||
        next.pan.elevation_m !== pan.elevation_m
      ) {
        onPanChange(next.pan);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [
    containerRef,
    svgRef,
    zoom,
    viewHalfChainage,
    viewHalfElevation,
    pan,
    onZoomChange,
    onPanChange,
  ]);

  const canStartPan = useCallback(
    (e: React.PointerEvent) => e.button === 1 || (e.button === 0 && spacePressedRef.current),
    [],
  );

  const onPanPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!canStartPan(e)) return;
      e.preventDefault();
      e.stopPropagation();
      panDragRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanChainage: pan.chainage_m,
        startPanElevation: pan.elevation_m,
      };
      setIsPanning(true);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    },
    [canStartPan, pan.chainage_m, pan.elevation_m],
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
        chainage_m: drag.startPanChainage - dx * mpp,
        elevation_m: drag.startPanElevation + dy * mpp,
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
    onPanPointerDown,
    onPanPointerMove,
    onPanPointerUp,
    onPanPointerCancel: onPanPointerUp,
  };
}

export { clampProfileSketchZoom };
