/** Visual profile for 3D linear infrastructure (flat shading, no shadows). */
export type Line3dVisualStyle = {
  radiusMul: number;
  /** Low segment count for roads = flatter ribbon silhouette. */
  radialSegments: number;
};

const STYLES: Record<string, Line3dVisualStyle> = {
  autoroad: { radiusMul: 1.2, radialSegments: 4 },
  oil_pipeline: { radiusMul: 1, radialSegments: 10 },
  gas_pipeline: { radiusMul: 1, radialSegments: 10 },
  methanol_pipeline: { radiusMul: 1, radialSegments: 10 },
  water_pipeline: { radiusMul: 1, radialSegments: 10 },
  power_line: { radiusMul: 0.9, radialSegments: 6 },
  additional_line: { radiusMul: 1, radialSegments: 8 },
};

const DEFAULT_STYLE: Line3dVisualStyle = {
  radiusMul: 1,
  radialSegments: 8,
};

export function resolveLine3dVisualStyle(
  subtype: string,
  selected: boolean,
): Line3dVisualStyle {
  const base = { ...(STYLES[subtype] ?? DEFAULT_STYLE) };
  if (!selected) return base;
  return { ...base, radiusMul: base.radiusMul * 1.08 };
}
