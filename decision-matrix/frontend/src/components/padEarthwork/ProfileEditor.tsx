import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Mountain } from 'lucide-react';
import {
  profileLengthM,
  snapMeters,
  sortChainagePoints,
  type ProfileSketch,
} from '../../lib/padEarthworkSketch';
import {
  axisTicks,
  formatChainageM,
  formatProfileElevationM,
  niceAxisStep,
} from '../../lib/profileSketchAxes';
import {
  balanceProfileViewHalves,
  buildProfileViewBox,
  profileFitPan,
  profileGridLines,
  profileViewExtents,
  type ProfileSketchPan,
} from '../../lib/profileSketchViewport';
import {
  buildProfileEnvelopeBodyPolygon,
  profileChainageBounds,
  type ProfileEnvelopeParams,
} from '../../lib/profileEnvelope';
import { useProfileSketchViewport } from './useProfileSketchViewport';

function buildFillCutPolygons(sketch: ProfileSketch): { fill: string; cut: string }[] {
  const points = sortChainagePoints(sketch.chainage_points);
  const design = sketch.design_elevation_m;
  const polys: { fill: string; cut: string }[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const s0 = points[i].chainage_m;
    const z0 = points[i].elevation_m;
    const s1 = points[i + 1].chainage_m;
    const z1 = points[i + 1].elevation_m;
    if (s1 <= s0) continue;
    const avgFill = (Math.max(design - z0, 0) + Math.max(design - z1, 0)) / 2;
    const avgCut = (Math.max(z0 - design, 0) + Math.max(z1 - design, 0)) / 2;
    if (avgFill > 0.01) {
      polys.push({
        fill: `${s0},${design} ${s1},${design} ${s1},${z1} ${s0},${z0}`,
        cut: '',
      });
    }
    if (avgCut > 0.01) {
      polys.push({
        fill: '',
        cut: `${s0},${design} ${s1},${design} ${s1},${z1} ${s0},${z0}`,
      });
    }
  }
  return polys;
}

export type ProfileEditorProps = {
  sketch: ProfileSketch;
  onChange: (sketch: ProfileSketch) => void;
  readOnly: boolean;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  pan: ProfileSketchPan;
  onPanChange: (pan: ProfileSketchPan) => void;
  fitViewNonce: number;
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
  onSampleDem?: () => void;
  sampleDemPending?: boolean;
  demAvailable?: boolean;
  envelope?: { enabled: boolean; wrap_width_m: number } | null;
  referenceElevationM?: number;
  heightM?: number;
};

export function ProfileEditor({
  sketch,
  onChange,
  readOnly,
  zoom,
  onZoomChange,
  pan,
  onPanChange,
  fitViewNonce,
  selectedIndex,
  onSelectIndex,
  onSampleDem,
  sampleDemPending = false,
  demAvailable = false,
  envelope = null,
  referenceElevationM = 0,
  heightM = 0,
}: ProfileEditorProps) {
  const envelopeActive = Boolean(envelope?.enabled && envelope.wrap_width_m > 0);
  const wrapWidthM = envelopeActive ? envelope!.wrap_width_m : 0;
  const referenceY =
    Number.isFinite(referenceElevationM) && Number.isFinite(heightM)
      ? referenceElevationM
      : sketch.design_elevation_m - heightM;

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragIndexRef = useRef<number | null>(null);
  const dragDesignRef = useRef(false);
  const [stableExtents] = useState(() =>
    profileViewExtents(sketch, envelopeActive, wrapWidthM, referenceY),
  );
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const didMountFitRef = useRef(false);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setContainerSize({ width, height });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (didMountFitRef.current) return;
    didMountFitRef.current = true;
    if (fitViewNonce !== 0) return;
    const ext = profileViewExtents(sketch, envelopeActive, wrapWidthM, referenceY);
    onPanChange(profileFitPan(ext));
  }, [fitViewNonce, onPanChange, sketch, envelopeActive, wrapWidthM, referenceY]);

  useEffect(() => {
    if (fitViewNonce === 0) return;
    const ext = profileViewExtents(sketch, envelopeActive, wrapWidthM, referenceY);
    onPanChange(profileFitPan(ext));
  }, [fitViewNonce, onPanChange, sketch, envelopeActive, wrapWidthM, referenceY]);

  const extents = useMemo(
    () => profileViewExtents(sketch, envelopeActive, wrapWidthM, referenceY),
    [sketch, envelopeActive, wrapWidthM, referenceY],
  );
  const rawViewHalfChainage =
    (stableExtents.halfChainage / Math.max(zoom, 0.25)) *
    (extents.halfChainage / stableExtents.halfChainage);
  const rawViewHalfElevation =
    (stableExtents.halfElevation / Math.max(zoom, 0.25)) *
    (extents.halfElevation / stableExtents.halfElevation);
  const { viewHalfChainage, viewHalfElevation } = balanceProfileViewHalves(
    rawViewHalfChainage,
    rawViewHalfElevation,
    containerSize?.width ?? rawViewHalfChainage * 2,
    containerSize?.height ?? rawViewHalfElevation * 2,
  );

  const minChainage = pan.chainage_m - viewHalfChainage;
  const maxChainage = pan.chainage_m + viewHalfChainage;
  const minElevation = pan.elevation_m - viewHalfElevation;
  const maxElevation = pan.elevation_m + viewHalfElevation;

  const chainageStep = niceAxisStep(maxChainage - minChainage, 6);
  const elevationStep = niceAxisStep(maxElevation - minElevation, 5);
  const chainageTicks = axisTicks(minChainage, maxChainage, chainageStep);
  const elevationTicks = axisTicks(minElevation, maxElevation, elevationStep);

  const viewport = useProfileSketchViewport({
    containerRef,
    svgRef,
    zoom,
    onZoomChange,
    pan,
    onPanChange,
    viewHalfChainage,
    viewHalfElevation,
  });

  const viewBox = buildProfileViewBox(
    pan.chainage_m,
    pan.elevation_m,
    viewHalfChainage,
    viewHalfElevation,
  );
  const gridLines = profileGridLines(
    pan.chainage_m,
    pan.elevation_m,
    viewHalfChainage,
    viewHalfElevation,
    chainageStep,
    elevationStep,
  );
  const sortedPoints = sortChainagePoints(sketch.chainage_points);
  const terrainPolyline = sortedPoints.map((p) => `${p.chainage_m},${p.elevation_m}`).join(' ');
  const { minChainage: padMinS, maxChainage: padMaxS } = profileChainageBounds(sortedPoints);
  const envelopeParams: ProfileEnvelopeParams | null = envelopeActive
    ? {
        minChainage: padMinS,
        maxChainage: padMaxS,
        designElevationM: sketch.design_elevation_m,
        referenceElevationM: referenceY,
        wrapWidthM,
      }
    : null;
  const fillCutPolys = buildFillCutPolygons(sketch);
  const envelopeBodyPolygon = envelopeParams
    ? buildProfileEnvelopeBodyPolygon(envelopeParams)
    : null;
  const envelopeLeftToe = padMinS;
  const envelopeRightToe = padMaxS;
  const designY = sketch.design_elevation_m;
  const lengthM = profileLengthM(sketch.chainage_points);
  const hasProfile = sortedPoints.length >= 2;
  const activeIndex = selectedIndex ?? hoverIndex;
  const activePoint =
    activeIndex != null && activeIndex >= 0 && activeIndex < sketch.chainage_points.length
      ? sketch.chainage_points[activeIndex]
      : null;

  const clientToLocal = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const local = pt.matrixTransform(ctm.inverse());
    return { chainage_m: local.x, elevation_m: local.y };
  }, []);

  const onVertexPointerDown = (index: number, e: React.PointerEvent) => {
    if (readOnly || e.button !== 0 || viewport.isPanning) return;
    e.stopPropagation();
    dragIndexRef.current = index;
    onSelectIndex(index);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onDesignPointerDown = (e: React.PointerEvent) => {
    if (readOnly || e.button !== 0 || viewport.isPanning) return;
    e.stopPropagation();
    dragDesignRef.current = true;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onSvgPointerMove = (e: React.PointerEvent) => {
    const local = clientToLocal(e.clientX, e.clientY);
    if (!local) return;
    if (dragDesignRef.current) {
      onChange({
        ...sketch,
        design_elevation_m: snapMeters(local.elevation_m, 0.1),
      });
      return;
    }
    const idx = dragIndexRef.current;
    if (idx == null) return;
    const next = sketch.chainage_points.map((p, i) =>
      i === idx
        ? {
            chainage_m: snapMeters(Math.max(0, local.chainage_m), 1),
            elevation_m: snapMeters(local.elevation_m, 0.1),
          }
        : p,
    );
    onChange({ ...sketch, chainage_points: sortChainagePoints(next) });
  };

  const onSvgPointerUp = () => {
    dragIndexRef.current = null;
    dragDesignRef.current = false;
  };

  const designLabelX = Math.min(maxChainage - 2, pan.chainage_m + viewHalfChainage * 0.55);

  return (
    <div
      ref={containerRef}
      className={`pad-earthwork-sketch-editor profile-sketch-editor${viewport.isPanning ? ' pad-earthwork-sketch-editor--panning' : ''}`}
      onPointerDown={viewport.onPanPointerDown}
      onPointerMove={viewport.onPanPointerMove}
      onPointerUp={viewport.onPanPointerUp}
      onPointerCancel={viewport.onPanPointerCancel}
    >
      {!hasProfile && (
        <div className="profile-sketch-editor__empty" aria-live="polite">
          <Mountain size={28} strokeWidth={1.5} aria-hidden />
          <p className="profile-sketch-editor__empty-title">Профиль не задан</p>
          <p className="profile-sketch-editor__empty-text">
            {demAvailable
              ? 'Сэмплируйте рельеф из DEM или добавьте точки вручную.'
              : 'Добавьте минимум 2 точки или загрузите DEM на вкладке «План».'}
          </p>
          {!readOnly && demAvailable && onSampleDem && (
            <button
              type="button"
              className="btn btn-primary btn-sm profile-sketch-editor__empty-btn"
              disabled={sampleDemPending}
              onClick={onSampleDem}
            >
              {sampleDemPending ? 'Съёмка…' : 'Сэмплировать DEM'}
            </button>
          )}
        </div>
      )}

      <svg
        ref={svgRef}
        className="pad-earthwork-sketch-editor__svg profile-sketch-editor__svg"
        viewBox={viewBox}
        visibility={containerSize ? 'visible' : 'hidden'}
        onPointerMove={onSvgPointerMove}
        onPointerUp={onSvgPointerUp}
        onPointerLeave={onSvgPointerUp}
      >
        <defs>
          <pattern id="profile-grid-minor" width={chainageStep} height={elevationStep} patternUnits="userSpaceOnUse">
            <rect width={chainageStep} height={elevationStep} className="profile-sketch-editor__grid-bg" />
          </pattern>
        </defs>

        <rect
          x={minChainage}
          y={minElevation}
          width={maxChainage - minChainage}
          height={maxElevation - minElevation}
          className="profile-sketch-editor__plot-bg"
        />

        {gridLines.map((line, i) => (
          <line
            key={`grid-${i}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            className="profile-sketch-editor__grid"
          />
        ))}

        <line
          x1={minChainage}
          y1={minElevation}
          x2={maxChainage}
          y2={minElevation}
          className="profile-sketch-editor__axis profile-sketch-editor__axis--chainage"
        />
        <line
          x1={minChainage}
          y1={minElevation}
          x2={minChainage}
          y2={maxElevation}
          className="profile-sketch-editor__axis profile-sketch-editor__axis--elevation"
        />

        {chainageTicks.map((tick) => (
          <g key={`ct-${tick}`}>
            <line
              x1={tick}
              y1={minElevation}
              x2={tick}
              y2={minElevation + (maxElevation - minElevation) * 0.015}
              className="profile-sketch-editor__tick"
            />
            <text x={tick} y={minElevation - (maxElevation - minElevation) * 0.04} className="profile-sketch-editor__tick-label profile-sketch-editor__tick-label--chainage">
              {formatChainageM(tick)}
            </text>
          </g>
        ))}
        {elevationTicks.map((tick) => (
          <g key={`et-${tick}`}>
            <line
              x1={minChainage}
              y1={tick}
              x2={minChainage + (maxChainage - minChainage) * 0.012}
              y2={tick}
              className="profile-sketch-editor__tick"
            />
            <text x={minChainage - (maxChainage - minChainage) * 0.02} y={tick} className="profile-sketch-editor__tick-label profile-sketch-editor__tick-label--elevation">
              {formatProfileElevationM(tick)}
            </text>
          </g>
        ))}

        <text
          x={(minChainage + maxChainage) / 2}
          y={minElevation - (maxElevation - minElevation) * 0.1}
          className="profile-sketch-editor__axis-title"
        >
          Пикетаж, м
        </text>
        <text
          x={minChainage - (maxChainage - minChainage) * 0.08}
          y={(minElevation + maxElevation) / 2}
          className="profile-sketch-editor__axis-title profile-sketch-editor__axis-title--vertical"
          transform={`rotate(-90 ${minChainage - (maxChainage - minChainage) * 0.08} ${(minElevation + maxElevation) / 2})`}
        >
          Отметка, м
        </text>

        {hasProfile && (
          <>
            {fillCutPolys.map((poly, i) => (
              <g key={`seg-${i}`}>
                {poly.fill && (
                  <polygon points={poly.fill} className="profile-sketch-editor__fill" />
                )}
                {poly.cut && (
                  <polygon points={poly.cut} className="profile-sketch-editor__cut" />
                )}
              </g>
            ))}
            {envelopeBodyPolygon && (
              <polygon
                points={envelopeBodyPolygon}
                className="profile-sketch-editor__envelope-body"
              />
            )}
            {envelopeActive && (
              <line
                x1={envelopeLeftToe}
                y1={referenceY}
                x2={envelopeRightToe}
                y2={referenceY}
                className="profile-sketch-editor__reference-line"
              />
            )}
            <line
              x1={envelopeActive ? padMinS : minChainage}
              y1={designY}
              x2={envelopeActive ? padMaxS : maxChainage}
              y2={designY}
              className="profile-sketch-editor__design-line"
              onPointerDown={onDesignPointerDown}
            />
            <rect
              x={designLabelX}
              y={designY - 1.8}
              width={14}
              height={2.4}
              rx={0.4}
              className="profile-sketch-editor__design-badge"
              pointerEvents="none"
            />
            <text
              x={designLabelX + 7}
              y={designY - 0.35}
              className="profile-sketch-editor__design-label"
              pointerEvents="none"
            >
              {formatProfileElevationM(designY)} м
            </text>
            <circle
              cx={maxChainage - (maxChainage - minChainage) * 0.04}
              cy={designY}
              r={1.1}
              className="profile-sketch-editor__design-handle"
              onPointerDown={onDesignPointerDown}
            />
            <polyline
              points={terrainPolyline}
              className="profile-sketch-editor__terrain"
              fill="none"
            />
            {sortedPoints.map((p, i) => {
              const origIndex = sketch.chainage_points.findIndex(
                (pt) => pt.chainage_m === p.chainage_m && pt.elevation_m === p.elevation_m,
              );
              const idx = origIndex >= 0 ? origIndex : i;
              const isSelected = selectedIndex === idx;
              const isHovered = hoverIndex === idx;
              return (
                <g key={`v-${idx}-${p.chainage_m}`}>
                  <circle
                    cx={p.chainage_m}
                    cy={p.elevation_m}
                    r={3.5}
                    className="profile-sketch-editor__vertex-hit"
                    onPointerDown={(e) => onVertexPointerDown(idx, e)}
                    onPointerEnter={() => setHoverIndex(idx)}
                    onPointerLeave={() => setHoverIndex((h) => (h === idx ? null : h))}
                  />
                  <circle
                    cx={p.chainage_m}
                    cy={p.elevation_m}
                    r={isSelected ? 1.35 : isHovered ? 1.15 : 0.85}
                    className={`profile-sketch-editor__vertex${isSelected ? ' profile-sketch-editor__vertex--selected' : ''}${isHovered ? ' profile-sketch-editor__vertex--hover' : ''}`}
                    pointerEvents="none"
                  />
                </g>
              );
            })}
            {activePoint && (
              <g pointerEvents="none">
                <rect
                  x={activePoint.chainage_m + 1.5}
                  y={activePoint.elevation_m + 1.2}
                  width={16}
                  height={4.2}
                  rx={0.5}
                  className="profile-sketch-editor__tooltip-bg"
                />
                <text
                  x={activePoint.chainage_m + 2.2}
                  y={activePoint.elevation_m + 3.6}
                  className="profile-sketch-editor__tooltip-text"
                >
                  {formatChainageM(activePoint.chainage_m)} м · {formatProfileElevationM(activePoint.elevation_m)} м
                </text>
              </g>
            )}
          </>
        )}

        {hasProfile && (
          <text x={maxChainage - 1} y={maxElevation - 1} className="profile-sketch-editor__meta">
            L = {lengthM.toFixed(0)} м
          </text>
        )}
      </svg>
    </div>
  );
}
