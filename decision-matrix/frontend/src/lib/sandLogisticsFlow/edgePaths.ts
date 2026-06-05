import {
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  Position,
} from '@xyflow/react';
import type { SandLogisticsLineStyle, EdgePathInput } from './types';
import { polylineMidpoint } from './roadPolylines';

/** Общий расчёт SVG-пути для всех типов линий на схеме логистики. */
export function computeSandEdgePath(
  style: SandLogisticsLineStyle,
  input: EdgePathInput,
): [path: string, labelX: number, labelY: number] {
  if (style === 'straight') {
    const [path, labelX, labelY] = getStraightPath(input);
    return [path, labelX, labelY];
  }
  if (style === 'smoothstep') {
    const [path, labelX, labelY] = getSmoothStepPath({ ...input, borderRadius: 8 });
    return [path, labelX, labelY];
  }
  const [path, labelX, labelY] = getBezierPath(input);
  return [path, labelX, labelY];
}

/** SVG-путь по цепочке точек (упрощённая линия сети). */
export function polylineToSvgPath(
  style: SandLogisticsLineStyle,
  points: { x: number; y: number }[],
): [path: string, labelX: number, labelY: number] {
  if (points.length < 2) return ['', 0, 0];
  const mid = polylineMidpoint(points);

  if (style === 'straight') {
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    return [path, mid.x, mid.y];
  }

  let path = '';
  for (let i = 0; i < points.length - 1; i++) {
    const [segPath] = computeSandEdgePath(style, {
      sourceX: points[i]!.x,
      sourceY: points[i]!.y,
      targetX: points[i + 1]!.x,
      targetY: points[i + 1]!.y,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });
    if (i === 0) {
      path = segPath;
      continue;
    }
    const lIdx = segPath.indexOf('L');
    const cIdx = segPath.indexOf('C');
    if (cIdx >= 0) {
      path += ` ${segPath.slice(cIdx)}`;
    } else if (lIdx >= 0) {
      path += ` ${segPath.slice(lIdx)}`;
    } else {
      path += ` L ${points[i + 1]!.x} ${points[i + 1]!.y}`;
    }
  }
  return [path, mid.x, mid.y];
}
