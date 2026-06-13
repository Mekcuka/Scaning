import { useCallback, useMemo, useRef, useState } from 'react';
import { Compass } from 'lucide-react';
import { LINE_SUBTYPES, SUBTYPE_LABELS } from '../../lib/api';
import {
  attachMarkerLocal,
  clientToLocalEnuFromSvg,
  computeFootprintPickerViewBox,
  edgeSegmentLocal,
  localEnuToSvg,
  outwardOffsetFromEdgeMid,
  pickFootprintPerimeterAttach,
  polygonPathFromLocal,
  ringLonLatToLocalEnu,
} from '../../lib/footprintPerimeterPickerGeo';
import {
  cardinalDirectionFromEdgeIndex,
  connectionsFromCardinalTemplate,
  footprintRingEdges,
  type FootprintCardinalDirection,
  type FootprintLineConnectionTemplate,
} from '../../lib/padFootprintLineAttach';
import { linePreviewColor, templateEntrySummary } from './footprintConnectionTemplateUi';

const CARDINAL_SHORT: Record<FootprintCardinalDirection, string> = {
  north: 'С',
  south: 'Ю',
  east: 'В',
  west: 'З',
};

function spreadT(baseT: number, slot: number, total: number): number {
  if (total <= 1) return baseT;
  const spread = 0.12;
  const offset = (slot - (total - 1) / 2) * spread;
  return Math.max(0.05, Math.min(0.95, baseT + offset));
}

interface FootprintConnectionTemplatePreviewProps {
  ring: [number, number][];
  anchorLon: number;
  anchorLat: number;
  template: FootprintLineConnectionTemplate;
  activeLineSubtype: string;
  readOnly?: boolean;
  onActiveLineSubtypeChange?: (lineSubtype: string) => void;
  onPick?: (lineSubtype: string, cardinal: FootprintCardinalDirection, t: number) => void;
}

export function FootprintConnectionTemplatePreview({
  ring,
  anchorLon,
  anchorLat,
  template,
  activeLineSubtype,
  readOnly = false,
  onActiveLineSubtypeChange,
  onPick,
}: FootprintConnectionTemplatePreviewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverEdge, setHoverEdge] = useState<number | null>(null);

  const localRing = useMemo(
    () => ringLonLatToLocalEnu(ring, anchorLon, anchorLat),
    [ring, anchorLon, anchorLat],
  );
  const viewBox = useMemo(() => computeFootprintPickerViewBox(localRing), [localRing]);
  const fillPath = useMemo(() => polygonPathFromLocal(localRing), [localRing]);
  const resolved = useMemo(
    () => connectionsFromCardinalTemplate(ring, template),
    [ring, template],
  );

  const edgeLabels = useMemo(() => {
    return footprintRingEdges(ring).map((edge) => {
      const cardinal = cardinalDirectionFromEdgeIndex(ring, edge.edgeIndex);
      const offset = outwardOffsetFromEdgeMid(localRing, edge.edgeIndex, 0.5, 6);
      if (!offset || !cardinal) return null;
      const { x, y } = localEnuToSvg(offset);
      return { key: edge.edgeIndex, x, y, text: CARDINAL_SHORT[cardinal] };
    });
  }, [ring, localRing]);

  const markers = useMemo(() => {
    const byEdge = new Map<number, string[]>();
    for (const st of LINE_SUBTYPES) {
      const attach = resolved[st];
      if (!attach || attach.edge_index < 0) continue;
      const list = byEdge.get(attach.edge_index) ?? [];
      list.push(st);
      byEdge.set(attach.edge_index, list);
    }

    const items: {
      lineSubtype: string;
      x: number;
      y: number;
      color: string;
      active: boolean;
    }[] = [];

    for (const st of LINE_SUBTYPES) {
      const attach = resolved[st];
      if (!attach || attach.edge_index < 0) continue;
      const group = byEdge.get(attach.edge_index) ?? [st];
      const slot = group.indexOf(st);
      const t = spreadT(attach.t ?? 0.5, slot, group.length);
      const local = attachMarkerLocal(ring, anchorLon, anchorLat, attach.edge_index, t);
      if (!local) continue;
      const { x, y } = localEnuToSvg(local);
      items.push({
        lineSubtype: st,
        x,
        y,
        color: linePreviewColor(st),
        active: st === activeLineSubtype,
      });
    }
    return items;
  }, [resolved, ring, anchorLon, anchorLat, activeLineSubtype]);

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

  const applyPick = useCallback(
    (clientX: number, clientY: number) => {
      if (readOnly || !onPick) return;
      const pick = pickFromClient(clientX, clientY);
      if (!pick) return;
      const cardinal = cardinalDirectionFromEdgeIndex(ring, pick.edge_index);
      if (!cardinal) return;
      onPick(activeLineSubtype, cardinal, pick.t);
    },
    [readOnly, onPick, pickFromClient, ring, activeLineSubtype],
  );

  const legendItems = useMemo(() => {
    return LINE_SUBTYPES.filter((st) => st in template).map((st) => ({
      st,
      label: SUBTYPE_LABELS[st] ?? st,
      text: templateEntrySummary(template[st]),
      color: linePreviewColor(st),
    }));
  }, [template]);

  const hasLegend = legendItems.length > 0;

  return (
    <div className="footprint-connect-preview">
      <p className="footprint-connect-preview__title">Схема шаблона</p>
      <p className="footprint-connect-preview__subtitle">
        Эталонная площадка 120×80 м, поворот 0°. Стороны света подписаны на контуре.
      </p>
      <div className="footprint-perimeter-picker footprint-connect-preview__diagram">
        <svg
          ref={svgRef}
          className={`footprint-perimeter-picker__svg footprint-connect-preview__svg${
            readOnly ? ' footprint-perimeter-picker__svg--readonly' : ''
          }`}
          viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Схема контура площадки с точками подключения линий"
          onPointerDown={(e) => {
            if (readOnly) return;
            e.preventDefault();
            svgRef.current?.setPointerCapture(e.pointerId);
            applyPick(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (readOnly) return;
            const pick = pickFromClient(e.clientX, e.clientY);
            setHoverEdge(pick?.edge_index ?? null);
            if (e.buttons !== 0) applyPick(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            try {
              svgRef.current?.releasePointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
          }}
          onPointerLeave={() => setHoverEdge(null)}
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
          {edgeLabels.map(
            (lbl) =>
              lbl && (
                <text
                  key={lbl.key}
                  className="footprint-connect-preview__edge-label"
                  x={lbl.x}
                  y={lbl.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  pointerEvents="none"
                >
                  {lbl.text}
                </text>
              ),
          )}
          <circle
            className="footprint-perimeter-picker__center"
            cx={0}
            cy={0}
            r={viewBox.width * 0.018}
            pointerEvents="none"
          />
          {markers.map((m) => (
            <g key={m.lineSubtype} pointerEvents="none">
              <circle
                className={`footprint-connect-preview__marker-ring${m.active ? ' footprint-connect-preview__marker-ring--active' : ''}`}
                cx={m.x}
                cy={m.y}
                r={viewBox.width * (m.active ? 0.034 : 0.026)}
                stroke={m.color}
              />
              <circle
                className={`footprint-connect-preview__marker${m.active ? ' footprint-connect-preview__marker--active' : ''}`}
                cx={m.x}
                cy={m.y}
                r={viewBox.width * (m.active ? 0.02 : 0.015)}
                fill={m.color}
              />
            </g>
          ))}
        </svg>
        {!readOnly && (
          <p className="footprint-connect-preview__hint">
            Клик по контуру задаёт сторону света для выбранного типа линии (
            {SUBTYPE_LABELS[activeLineSubtype] ?? activeLineSubtype}).
          </p>
        )}
      </div>
      {hasLegend ? (
        <ul className="footprint-connect-preview__legend">
          {legendItems.map((item) => (
            <li key={item.st}>
              <button
                type="button"
                className={`footprint-connect-preview__legend-item${
                  item.st === activeLineSubtype
                    ? ' footprint-connect-preview__legend-item--active'
                    : ''
                }`}
                onClick={() => onActiveLineSubtypeChange?.(item.st)}
              >
                <span
                  className="footprint-connect-preview__legend-dot"
                  style={{ backgroundColor: item.color }}
                  aria-hidden
                />
                <span className="footprint-connect-preview__legend-label">{item.label}</span>
                <span className="footprint-connect-preview__legend-value">{item.text}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="footprint-connect-preview__empty">
          <Compass size={28} aria-hidden className="footprint-connect-preview__empty-icon" />
          <p>Выберите тип линии и сторону света — точка появится на схеме.</p>
        </div>
      )}
    </div>
  );
}
