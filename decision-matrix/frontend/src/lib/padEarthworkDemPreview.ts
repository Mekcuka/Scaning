/** Elevation gradient + cut/fill overlay for pad DEM preview grid. */

export type PadDemPreviewBounds = {
  min_east_m: number;
  max_east_m: number;
  min_north_m: number;
  max_north_m: number;
};

export type PadDemPreview = {
  bounds: PadDemPreviewBounds;
  cols: number;
  rows: number;
  cell_size_m: number;
  elev_min: number;
  elev_max: number;
  footprint_elev_min?: number;
  design_elevation_m: number;
  elevations: (number | null)[];
  cut_fill: (number | null)[];
};

const FILL_RGBA: [number, number, number, number] = [59, 130, 246, 110];
const CUT_RGBA: [number, number, number, number] = [249, 115, 22, 110];

/** Normalized elevation stops: low → high (classic hypsometric gradient). */
export const ELEVATION_GRADIENT_STOPS: ReadonlyArray<{
  t: number;
  rgb: readonly [number, number, number];
}> = [
  { t: 0, rgb: [24, 78, 163] },
  { t: 0.18, rgb: [46, 139, 87] },
  { t: 0.38, rgb: [154, 205, 50] },
  { t: 0.58, rgb: [218, 165, 32] },
  { t: 0.78, rgb: [160, 82, 45] },
  { t: 1, rgb: [245, 242, 235] },
];

export function normalizeElevation(elev: number, min: number, max: number): number {
  const span = Math.max(1e-6, max - min);
  return Math.min(1, Math.max(0, (elev - min) / span));
}

/** Interpolate RGB along the elevation gradient (t in 0..1). */
export function gradientRgbAt(t: number): [number, number, number] {
  const clamped = Math.min(1, Math.max(0, t));
  for (let i = 0; i < ELEVATION_GRADIENT_STOPS.length - 1; i += 1) {
    const a = ELEVATION_GRADIENT_STOPS[i];
    const b = ELEVATION_GRADIENT_STOPS[i + 1];
    if (clamped >= a.t && clamped <= b.t) {
      const span = b.t - a.t || 1;
      const u = (clamped - a.t) / span;
      return [
        Math.round(a.rgb[0] + u * (b.rgb[0] - a.rgb[0])),
        Math.round(a.rgb[1] + u * (b.rgb[1] - a.rgb[1])),
        Math.round(a.rgb[2] + u * (b.rgb[2] - a.rgb[2])),
      ];
    }
  }
  const last = ELEVATION_GRADIENT_STOPS[ELEVATION_GRADIENT_STOPS.length - 1];
  return [last.rgb[0], last.rgb[1], last.rgb[2]];
}

/** Map elevation meters to gradient color. */
export function elevationRgb(elev: number, min: number, max: number): [number, number, number] {
  return gradientRgbAt(normalizeElevation(elev, min, max));
}

/** CSS linear-gradient for legend bar (fixed palette). */
export function elevationGradientCss(): string {
  const parts = ELEVATION_GRADIENT_STOPS.map(
    (stop) => `rgb(${stop.rgb.join(',')}) ${Math.round(stop.t * 100)}%`,
  );
  return `linear-gradient(to right, ${parts.join(', ')})`;
}

function fillNodata(elevations: (number | null)[], cols: number, rows: number): Float32Array {
  const out = new Float32Array(cols * rows);
  let fallback = 0;
  for (const v of elevations) {
    if (v != null && Number.isFinite(v)) {
      fallback = v;
      break;
    }
  }
  for (let i = 0; i < elevations.length; i++) {
    const v = elevations[i];
    out[i] = v != null && Number.isFinite(v) ? v : fallback;
  }
  return out;
}

/** Simple Sobel hillshade normalized 0..1 (subtle relief shading). */
export function computeHillshade(
  elevations: (number | null)[],
  cols: number,
  rows: number,
): Float32Array {
  const z = fillNodata(elevations, cols, rows);
  const shade = new Float32Array(cols * rows);
  const idx = (c: number, r: number) => r * cols + c;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const z00 = z[idx(Math.max(0, c - 1), Math.max(0, r - 1))];
      const z01 = z[idx(c, Math.max(0, r - 1))];
      const z02 = z[idx(Math.min(cols - 1, c + 1), Math.max(0, r - 1))];
      const z10 = z[idx(Math.max(0, c - 1), r)];
      const z12 = z[idx(Math.min(cols - 1, c + 1), r)];
      const z20 = z[idx(Math.max(0, c - 1), Math.min(rows - 1, r + 1))];
      const z21 = z[idx(c, Math.min(rows - 1, r + 1))];
      const z22 = z[idx(Math.min(cols - 1, c + 1), Math.min(rows - 1, r + 1))];

      const dzdx = (z02 + 2 * z12 + z22 - (z00 + 2 * z10 + z20)) / 8;
      const dzdy = (z20 + 2 * z21 + z22 - (z00 + 2 * z01 + z02)) / 8;
      const slope = Math.sqrt(dzdx * dzdx + dzdy * dzdy);
      const aspect = Math.atan2(dzdy, -dzdx);
      const az = Math.PI / 4;
      const alt = Math.PI / 3;
      const raw =
        Math.sin(alt) * Math.cos(Math.atan(slope)) +
        Math.cos(alt) * Math.sin(Math.atan(slope)) * Math.cos(az - aspect);
      shade[idx(c, r)] = Math.min(1, Math.max(0.25, raw));
    }
  }
  return shade;
}

function worldToCanvas(
  eastM: number,
  northM: number,
  panEast: number,
  panNorth: number,
  viewHalf: number,
  width: number,
  height: number,
): [number, number] {
  const minEast = panEast - viewHalf;
  const minNorth = panNorth - viewHalf;
  const u = (eastM - minEast) / (2 * viewHalf);
  const v = (-northM - (-panNorth - viewHalf)) / (2 * viewHalf);
  return [u * width, v * height];
}

function buildGradientImageData(
  preview: PadDemPreview,
  hillshade: Float32Array,
): ImageData | null {
  const { cols, rows, elev_min: elevMin, elev_max: elevMax } = preview;
  if (cols < 1 || rows < 1) return null;

  const data = new Uint8ClampedArray(cols * rows * 4);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      const elev = preview.elevations[i];
      const offset = i * 4;
      if (elev == null || !Number.isFinite(elev)) {
        data[offset + 3] = 0;
        continue;
      }
      const [r, g, b] = elevationRgb(elev, elevMin, elevMax);
      const relief = 0.82 + 0.18 * hillshade[i];
      data[offset] = Math.round(r * relief);
      data[offset + 1] = Math.round(g * relief);
      data[offset + 2] = Math.round(b * relief);
      data[offset + 3] = 255;
    }
  }
  return new ImageData(data, cols, rows);
}

export function renderDemPreviewOnCanvas(
  ctx: CanvasRenderingContext2D,
  preview: PadDemPreview,
  viewHalf: number,
  pan: { east_m: number; north_m: number } = { east_m: 0, north_m: 0 },
): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  const { cols, rows, cell_size_m: cellSize } = preview;
  const { min_east_m: minEast, min_north_m: minNorth, max_east_m: maxEast, max_north_m: maxNorth } =
    preview.bounds;
  const hillshade = computeHillshade(preview.elevations, cols, rows);
  const imageData = buildGradientImageData(preview, hillshade);
  if (!imageData) return;

  const offscreen = document.createElement('canvas');
  offscreen.width = cols;
  offscreen.height = rows;
  const offCtx = offscreen.getContext('2d');
  if (!offCtx) return;
  offCtx.putImageData(imageData, 0, 0);

  const [sx0, syTop] = worldToCanvas(minEast, maxNorth, pan.east_m, pan.north_m, viewHalf, width, height);
  const [sx1, syBottom] = worldToCanvas(maxEast, minNorth, pan.east_m, pan.north_m, viewHalf, width, height);
  const sw = sx1 - sx0;
  const sh = syBottom - syTop;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(offscreen, 0, 0, cols, rows, sx0, syTop, sw, sh);
  ctx.restore();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      const cf = preview.cut_fill[i];
      if (cf !== 1 && cf !== -1) continue;

      const east0 = minEast + col * cellSize;
      const east1 = east0 + cellSize;
      const north0 = minNorth + row * cellSize;
      const north1 = north0 + cellSize;

      const [x0, y0] = worldToCanvas(east0, north1, pan.east_m, pan.north_m, viewHalf, width, height);
      const [x1, y1] = worldToCanvas(east1, north0, pan.east_m, pan.north_m, viewHalf, width, height);
      const w = x1 - x0;
      const h = y1 - y0;

      ctx.fillStyle = cf === 1 ? `rgba(${FILL_RGBA.join(',')})` : `rgba(${CUT_RGBA.join(',')})`;
      ctx.fillRect(x0, y0, w + 0.5, h + 0.5);
    }
  }
}

function sampleDemPreviewElevationAt(
  preview: PadDemPreview,
  eastM: number,
  northM: number,
): number | null {
  const { bounds, cols, rows, cell_size_m: cellSize, elevations } = preview;
  if (cols < 2 || rows < 2 || cellSize <= 0) return null;

  const colF = (eastM - bounds.min_east_m) / cellSize;
  const rowF = (northM - bounds.min_north_m) / cellSize;
  if (colF < 0 || rowF < 0 || colF > cols - 1 || rowF > rows - 1) return null;

  const c0 = Math.floor(colF);
  const r0 = Math.floor(rowF);
  const c1 = Math.min(cols - 1, c0 + 1);
  const r1 = Math.min(rows - 1, r0 + 1);
  const tx = colF - c0;
  const ty = rowF - r0;

  const sample = (c: number, r: number): number | null => {
    const v = elevations[r * cols + c];
    return v != null && Number.isFinite(v) ? v : null;
  };

  const z00 = sample(c0, r0);
  const z10 = sample(c1, r0);
  const z01 = sample(c0, r1);
  const z11 = sample(c1, r1);
  const samples = [z00, z10, z01, z11].filter((v): v is number => v != null);
  if (samples.length === 0) return null;
  if (samples.length < 4) {
    return samples.reduce((a, b) => a + b, 0) / samples.length;
  }
  const z0 = z00! * (1 - tx) + z10! * tx;
  const z1 = z01! * (1 - tx) + z11! * tx;
  return z0 * (1 - ty) + z1 * ty;
}

export function formatElevationM(value: number): string {
  return `${value.toFixed(1)} м`;
}

/** Minimum terrain elevation inside pad footprint (m AMSL). */
export function footprintMinElevationM(preview: PadDemPreview): number | null {
  if (preview.footprint_elev_min != null && Number.isFinite(preview.footprint_elev_min)) {
    return preview.footprint_elev_min;
  }
  let min: number | null = null;
  for (let i = 0; i < preview.elevations.length; i += 1) {
    if (preview.cut_fill[i] == null) continue;
    const elev = preview.elevations[i];
    if (elev == null || !Number.isFinite(elev)) continue;
    min = min == null ? elev : Math.min(min, elev);
  }
  return min;
}
