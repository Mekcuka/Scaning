import { useCallback, useMemo, useRef, useState } from 'react';
import type { FootprintEdgeAttach } from '../../lib/padFootprintLineAttach';
import {
  attachMarkerLocal,
  clientToLocalEnuFromSvg,
  computeFootprintPickerViewBox,
  edgeSegmentLocal,
  pickFootprintPerimeterAttach,
  polygonPathFromLocal,
  ringLonLatToLocalEnu,
} from '../../lib/footprintPerimeterPickerGeo';

interface FootprintPerimeterPickerProps {
  ring: [number, number][];
  anchorLon: number;
  anchorLat: number;
  attach?: FootprintEdgeAttach;
  readOnly?: boolean;
  onPick: (edgeIndex: number, t: number) => void;
}

export function FootprintPerimeterPicker({
  ring,
  anchorLon,
  anchorLat,
  attach,
  readOnly = false,
  onPick,
}: FootprintPerimeterPickerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverEdge, setHoverEdge] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const localRing = useMemo(
    () => ringLonLatToLocalEnu(ring, anchorLon, anchorLat),
    [ring, anchorLon, anchorLat],
  );

  const viewBox = useMemo(() => computeFootprintPickerViewBox(localRing), [localRing]);

  const fillPath = useMemo(() => polygonPathFromLocal(localRing), [localRing]);

  const markerLocal = useMemo(() => {
    if (attach == null || attach.edge_index < 0) return null;
    return attachMarkerLocal(ring, anchorLon, anchorLat, attach.edge_index, attach.t ?? 0.5);
  }, [attach, ring, anchorLon, anchorLat]);

  const markerSvg = markerLocal ? { x: markerLocal.east_m, y: -markerLocal.north_m } : null;

  const hoverSegment = hoverEdge != null ? edgeSegmentLocal(localRing, hoverEdge) : null;

  const pickFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return null;
      const click = clientToLocalEnuFromSvg(svg, clientX, clientY);
      if (!click) return null;
      return pickFootprintPerimeterAttach(localRing, click, viewBox.width);
    },
    [localRing, viewBox.width],
  );

  const updateHover = useCallback(
    (clientX: number, clientY: number) => {
      const pick = pickFromClient(clientX, clientY);
      setHoverEdge(pick?.edge_index ?? null);
    },
    [pickFromClient],
  );

  const applyPick = useCallback(
    (clientX: number, clientY: number) => {
      const pick = pickFromClient(clientX, clientY);
      if (pick) onPick(pick.edge_index, pick.t);
    },
    [pickFromClient, onPick],
  );

  const onSvgPointerDown = (e: React.PointerEvent) => {
    if (readOnly) return;
    e.preventDefault();
    setDragging(true);
    svgRef.current?.setPointerCapture(e.pointerId);
    applyPick(e.clientX, e.clientY);
  };

  const onSvgPointerMove = (e: React.PointerEvent) => {
    if (readOnly) return;
    updateHover(e.clientX, e.clientY);
    if (dragging) applyPick(e.clientX, e.clientY);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    try {
      svgRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onPointerLeave = () => {
    if (!dragging) setHoverEdge(null);
  };

  return (
    <div className="footprint-perimeter-picker">
      <svg
        ref={svgRef}
        className={`footprint-perimeter-picker__svg${readOnly ? ' footprint-perimeter-picker__svg--readonly' : ''}`}
        viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Схема контура площадки — выберите точку подключения на периметре"
        onPointerDown={onSvgPointerDown}
        onPointerMove={onSvgPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
      >
        <path className="footprint-perimeter-picker__fill" d={fillPath} pointerEvents="none" />
        <path
          className="footprint-perimeter-picker__stroke"
          d={fillPath}
          fill="none"
          pointerEvents="none"
        />
        {hoverSegment && !readOnly && (
          <line
            className="footprint-perimeter-picker__hover-edge"
            x1={hoverSegment[0].x}
            y1={hoverSegment[0].y}
            x2={hoverSegment[1].x}
            y2={hoverSegment[1].y}
            pointerEvents="none"
          />
        )}
        <circle
          className="footprint-perimeter-picker__center"
          cx={0}
          cy={0}
          r={viewBox.width * 0.018}
          pointerEvents="none"
        />
        {markerSvg && (
          <>
            <circle
              className="footprint-perimeter-picker__marker-ring"
              cx={markerSvg.x}
              cy={markerSvg.y}
              r={viewBox.width * 0.028}
              pointerEvents="none"
            />
            <circle
              className="footprint-perimeter-picker__marker"
              cx={markerSvg.x}
              cy={markerSvg.y}
              r={viewBox.width * 0.016}
              pointerEvents="none"
            />
          </>
        )}
      </svg>
      {!readOnly && (
        <p className="object-detail-panel__hint footprint-perimeter-picker__hint">
          Клик или перетаскивание по контуру — точка подключения на периметре.
        </p>
      )}
    </div>
  );
}
