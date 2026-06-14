import type { PlanVertex } from '../../lib/padEarthworkSketch';
import type { PlanPolygonEditorView } from './usePlanPolygonEditor';

interface PlanPolygonEditorSvgProps {
  view: PlanPolygonEditorView;
  wellsLocal: PlanVertex[];
  showDemOverlay: boolean;
}

export function PlanPolygonEditorSvg({ view, wellsLocal, showDemOverlay }: PlanPolygonEditorSvgProps) {
  const {
    svgRef,
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
    svgClassName,
  } = view;

  return (
    <svg
      ref={svgRef}
      className={`${svgClassName}${showDemOverlay ? ' pad-earthwork-sketch-editor__svg--dem' : ''}`}
      viewBox={viewBox}
      onClick={onCanvasClick}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
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
        <text
          x={0}
          y={dimFont}
          className="pad-earthwork-sketch-editor__area-label"
          style={{ fontSize: dimFont }}
        >
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
  );
}
