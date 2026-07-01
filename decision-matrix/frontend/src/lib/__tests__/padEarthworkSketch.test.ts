import { describe, expect, it } from 'vitest';
import {
  computeStableViewHalfExtent,
  createDefaultPlanSketch,
  createDefaultPolygonSketch,
  estimateFillM3,
  localPlanCorners,
  localPlanEdgeMidpoints,
  formatPlanEdgeLengthM,
  insertPolygonVertexOnEdge,
  movePolygonEdgeFromDrag,
  nearestPolygonEdge,
  applyPlanAxisLock,
  pickPlanAxisLock,
  resolvePlanAxisDrag,
  polygonEdgeLabels,
  polygonVertexRightAngleGuides,
  vertexInteriorAngleDeg,
  offsetPolygonOutward,
  planFootprintAreaM2,
  planFromFormFields,
  parseSketchFromLast,
  polygonAreaM2,
  rectangleToPolygon,
  estimateEnvelopeFillM3,
  envelopeFillVolumeM3,
  sketchFromCornerDrag,
  sketchFromEdgeDrag,
  sketchFromRotationDrag,
  sketchToApiPayload,
  snapMeters,
  generatePadFromWells,
  computeWellPositionsEastM,
  tryLayoutPreviewFromWellForm,
  enuToRowLocal,
  validateGeneratedWellLayout,
} from '../padEarthworkSketch';

describe('padEarthworkSketch', () => {
  it('creates default plan', () => {
    const s = createDefaultPlanSketch(100, 50);
    expect(s.kind).toBe('plan_rectangle');
    expect(planFootprintAreaM2(s)).toBe(5000);
  });

  it('parses form fields', () => {
    const s = planFromFormFields('120', '80', '15');
    expect(s?.length_m).toBe(120);
    expect(s?.width_m).toBe(80);
    expect(s?.rotation_deg).toBe(15);
  });

  it('parses sketch from last response', () => {
    const s = parseSketchFromLast({
      kind: 'plan_rectangle',
      length_m: 40,
      width_m: 20,
      rotation_deg: 0,
    });
    expect(s?.length_m).toBe(40);
  });

  it('returns four local corners', () => {
    const corners = localPlanCorners(createDefaultPlanSketch(100, 50, 0));
    expect(corners).toHaveLength(4);
  });

  it('updates size on corner drag', () => {
    const base = createDefaultPlanSketch(100, 50, 0);
    const next = sketchFromCornerDrag(base, 1, 60, -30);
    expect(next.length_m).toBe(120);
    expect(next.width_m).toBe(60);
  });

  it('serializes api payload', () => {
    const payload = sketchToApiPayload(createDefaultPlanSketch(10, 5, 0));
    expect(payload.kind).toBe('plan_rectangle');
  });

  it('snaps to grid', () => {
    expect(snapMeters(7.3, 1)).toBe(7);
    expect(snapMeters(7.6, 1)).toBe(8);
  });

  it('estimates fill volume', () => {
    expect(estimateFillM3(createDefaultPlanSketch(10, 10, 0), 2)).toBe(200);
  });

  it('edge drag changes width', () => {
    const base = createDefaultPlanSketch(100, 50, 0);
    const next = sketchFromEdgeDrag(base, 0, 0, -40, { snapStep: 1 });
    expect(next.width_m).toBe(80);
  });

  it('rotation drag updates angle', () => {
    const base = createDefaultPlanSketch(100, 50, 0);
    const next = sketchFromRotationDrag(base, 50, 0, { snapStep: 5 });
    expect(next.rotation_deg).toBe(-90);
  });

  it('has edge midpoints', () => {
    expect(localPlanEdgeMidpoints(createDefaultPlanSketch(100, 50, 0))).toHaveLength(4);
  });

  it('parses polygon sketch from last', () => {
    const s = parseSketchFromLast({
      kind: 'plan_polygon',
      vertices: [
        { east_m: 0, north_m: 0 },
        { east_m: 10, north_m: 0 },
        { east_m: 0, north_m: 10 },
      ],
    });
    expect(s?.kind).toBe('plan_polygon');
    if (s?.kind === 'plan_polygon') expect(s.vertices).toHaveLength(3);
  });

  it('computes polygon area', () => {
    const poly = createDefaultPolygonSketch(10, 10);
    expect(polygonAreaM2(poly.vertices)).toBe(100);
  });

  it('converts rectangle to polygon', () => {
    const rect = createDefaultPlanSketch(100, 50, 0);
    const poly = rectangleToPolygon(rect);
    expect(poly.vertices).toHaveLength(4);
    expect(polygonAreaM2(poly.vertices)).toBe(5000);
  });

  it('finds nearest polygon edge', () => {
    const poly = rectangleToPolygon(createDefaultPlanSketch(100, 50, 0));
    const hit = nearestPolygonEdge(poly, 0, -30);
    expect(hit).not.toBeNull();
    expect(hit?.edgeIndex).toBe(0);
  });

  it('moves polygon edge by parallel translation', () => {
    const poly = rectangleToPolygon(createDefaultPlanSketch(10, 10, 0));
    const edgeStartA = poly.vertices[0];
    const edgeStartB = poly.vertices[1];
    const moved = movePolygonEdgeFromDrag(poly, 0, 2, 0, 0, 0, edgeStartA, edgeStartB);
    expect(moved.vertices[0].east_m).toBeCloseTo(edgeStartA.east_m + 2);
    expect(moved.vertices[1].east_m).toBeCloseTo(edgeStartB.east_m + 2);
    expect(moved.vertices[2]).toEqual(poly.vertices[2]);
  });

  it('inserts vertex on edge without duplicating endpoints', () => {
    const poly = rectangleToPolygon(createDefaultPlanSketch(10, 10, 0));
    const hit = nearestPolygonEdge(poly, 0, -5)!;
    const next = insertPolygonVertexOnEdge(poly, hit.edgeIndex, hit.east_m, hit.north_m);
    expect(next.vertices.length).toBe(poly.vertices.length + 1);
  });

  it('lists polygon edge labels for closed contour', () => {
    const poly = rectangleToPolygon(createDefaultPlanSketch(10, 20, 0));
    const labels = polygonEdgeLabels(poly.vertices, { closed: true });
    expect(labels).toHaveLength(4);
    const lengths = labels.map((label) => label.length_m).sort((a, b) => a - b);
    expect(lengths).toEqual([10, 10, 20, 20]);
    expect(formatPlanEdgeLengthM(12.34)).toBe('12,3');
    expect(formatPlanEdgeLengthM(12)).toBe('12');
  });

  it('shows right-angle guides when vertex angle is 90°', () => {
    const poly = rectangleToPolygon(createDefaultPlanSketch(10, 10, 0));
    expect(vertexInteriorAngleDeg(poly.vertices[3], poly.vertices[0], poly.vertices[1])).toBeCloseTo(
      90,
      5,
    );
    const guides = polygonVertexRightAngleGuides(poly.vertices, 0, 80, { closed: true });
    expect(guides).toHaveLength(2);
  });

  it('hides right-angle guides when vertex angle is not 90°', () => {
    const poly = rectangleToPolygon(createDefaultPlanSketch(10, 10, 0));
    const skewed = {
      ...poly,
      vertices: poly.vertices.map((v, i) => (i === 0 ? { east_m: v.east_m + 3, north_m: v.north_m + 1 } : v)),
    };
    const guides = polygonVertexRightAngleGuides(skewed.vertices, 0, 80, { closed: true });
    expect(guides).toHaveLength(0);
  });

  it('locks drag to dominant axis when Alt is held', () => {
    expect(pickPlanAxisLock(5, 1, null)).toBe('east');
    expect(pickPlanAxisLock(1, 5, null)).toBe('north');
    expect(pickPlanAxisLock(3, 3, null)).toBe('east');
    expect(pickPlanAxisLock(10, 1, 'north')).toBe('north');

    const horizontal = applyPlanAxisLock(12, 4, 0, 7, 'east');
    expect(horizontal).toEqual({ east_m: 12, north_m: 7 });

    const constrained = resolvePlanAxisDrag(12, 4, 0, 0, true, null);
    expect(constrained.constraint?.lock).toBe('east');
    expect(constrained.east_m).toBe(12);
    expect(constrained.north_m).toBe(4);

    const free = resolvePlanAxisDrag(12, 4, 0, 0, false, constrained.constraint);
    expect(free.constraint).toBeNull();
    expect(free.east_m).toBe(12);
    expect(free.north_m).toBe(4);
  });

  it('offsets square outward', () => {
    const square = rectangleToPolygon(createDefaultPlanSketch(10, 10, 0));
    const outer = offsetPolygonOutward(square.vertices, 2);
    expect(polygonAreaM2(outer)).toBeGreaterThan(100);
  });

  it('estimates envelope fill volume as truncated pyramid', () => {
    const vol = envelopeFillVolumeM3(100, 196, 2);
    expect(vol).toBeCloseTo(290 + 2 / 3, 5);
  });

  it('estimates envelope berm ring volume', () => {
    const rect = createDefaultPlanSketch(10, 10, 0);
    const vol = estimateEnvelopeFillM3(rect, 2, 2);
    expect(vol).not.toBeNull();
    expect(vol!).toBeCloseTo(35.555, 1);
  });

  it('keeps frozen view half-extent during drag', () => {
    expect(computeStableViewHalfExtent(100, 100, 1)).toBe(100);
    expect(computeStableViewHalfExtent(100, 100, 2)).toBe(50);
    expect(computeStableViewHalfExtent(200, 100, 1)).toBe(100);
    expect(computeStableViewHalfExtent(200, null, 1)).toBe(200);
  });

  it('computes well positions for two groups', () => {
    expect(computeWellPositionsEastM(8, 4, 30, 10)).toEqual([
      0, 30, 60, 90, 100, 130, 160, 190,
    ]);
  });

  it('generates pad polygon from wells', () => {
    const result = generatePadFromWells({
      wellCount: 4,
      wellsPerGroup: 4,
      wellSpacingM: 30,
      groupSpacingM: 10,
      margins: { leftM: 20, bottomM: 15, topM: 15, endM: 20 },
    });
    expect(result.sketch.kind).toBe('plan_polygon');
    expect(result.lengthM).toBe(130);
    expect(result.widthM).toBe(30);
    expect(result.wellsLocal).toHaveLength(4);
    expect(result.wellsLocal[0]).toEqual({ east_m: 0, north_m: 0 });
  });

  it('tryLayoutPreviewFromWellForm matches clustering sidebar defaults', () => {
    const preview = tryLayoutPreviewFromWellForm({
      padWellCount: '12',
      padWellsPerGroup: '1',
      padWellSpacingM: '9',
      padGroupSpacingM: '9',
      padMarginLeftM: '27',
      padMarginBottomM: '43',
      padMarginTopM: '15',
      padMarginEndM: '70',
      rotationDeg: '90',
    });
    expect(preview).not.toBeNull();
    expect(preview!.lengthM).toBe(196);
    expect(preview!.widthM).toBe(58);
    expect(preview!.wellsLocal).toHaveLength(12);
    const verts = preview!.sketch.vertices;
    const minE = Math.min(...verts.map((v) => v.east_m));
    const maxE = Math.max(...verts.map((v) => v.east_m));
    const minN = Math.min(...verts.map((v) => v.north_m));
    const maxN = Math.max(...verts.map((v) => v.north_m));
    expect(minE).toBeCloseTo(-27, 0);
    expect(maxE).toBeCloseTo(169, 0);
    expect(minN).toBeCloseTo(-43, 0);
    expect(maxN).toBeCloseTo(15, 0);
    expect(preview!.wellsLocal[0]!.east_m - minE).toBeCloseTo(27, 0);
    expect(maxE - preview!.wellsLocal[11]!.east_m).toBeCloseTo(70, 0);
  });

  it('NDS 180° orients well row south (top to bottom on plan)', () => {
    const result = generatePadFromWells({
      wellCount: 2,
      wellsPerGroup: 2,
      wellSpacingM: 50,
      groupSpacingM: 0,
      margins: { leftM: 10, bottomM: 10, topM: 10, endM: 10 },
      rotationDeg: 180,
    });
    expect(result.wellsLocal[1]?.north_m).toBeLessThan(0);
    expect(result.wellsLocal[1]?.east_m).toBeCloseTo(0, 0);
    expect(validateGeneratedWellLayout(result, {
      wellCount: 2,
      wellsPerGroup: 2,
      wellSpacingM: 50,
      groupSpacingM: 0,
      margins: { leftM: 10, bottomM: 10, topM: 10, endM: 10 },
      rotationDeg: 180,
    })).toBe(true);
  });

  it('validateGeneratedWellLayout for clustering sidebar at NDS 180°', () => {
    const input = {
      wellCount: 12,
      wellsPerGroup: 1,
      wellSpacingM: 9,
      groupSpacingM: 9,
      margins: { leftM: 27, bottomM: 43, topM: 15, endM: 70 },
      rotationDeg: 180,
    };
    const result = generatePadFromWells(input);
    expect(validateGeneratedWellLayout(result, input)).toBe(true);
    const first = enuToRowLocal(result.wellsLocal[0]!.east_m, result.wellsLocal[0]!.north_m, 180);
    const last = enuToRowLocal(
      result.wellsLocal[11]!.east_m,
      result.wellsLocal[11]!.north_m,
      180,
    );
    expect(first.east_m).toBeCloseTo(0, 1);
    expect(last.east_m).toBeCloseTo(99, 1);
    expect(last.east_m - first.east_m).toBeCloseTo(99, 1);
  });
});
