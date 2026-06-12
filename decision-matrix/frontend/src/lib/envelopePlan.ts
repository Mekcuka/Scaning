/** SVG helpers for envelope ring on plan sketch (top-down view). */

import type { PlanVertex } from './padEarthworkSketch';

function verticesToPath(vertices: PlanVertex[]): string {
  if (vertices.length < 3) return '';
  return (
    vertices
      .map((v, index) => `${index === 0 ? 'M' : 'L'} ${v.east_m} ${-v.north_m}`)
      .join(' ') + ' Z'
  );
}

/** Even-odd path: outer polygon minus inner hole (lower base ring in plan view). */
export function envelopePlanRingSvgPath(inner: PlanVertex[], outer: PlanVertex[]): string {
  if (inner.length < 3 || outer.length < 3) return '';
  return `${verticesToPath(outer)} ${verticesToPath(inner)}`;
}

/** Inner crest outline (trapezoid top of berm, dashed on plan). */
export function envelopePlanInnerCrestSvgPath(vertices: PlanVertex[]): string {
  return verticesToPath(vertices);
}
