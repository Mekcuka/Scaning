import { NET_SIZE } from './constants';
import type { LayoutRect, RoadSegment } from './types';

export function siteCenter(pos: { x: number; y: number }, w: number, h: number): { x: number; y: number } {
  return { x: pos.x + w / 2, y: pos.y + h / 2 };
}

export function networkCenter(pos: { x: number; y: number }): { x: number; y: number } {
  return { x: pos.x + NET_SIZE / 2, y: pos.y + NET_SIZE / 2 };
}

export function closestPointOnSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { x: number; y: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return { x: x1, y: y1 };
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return { x: x1 + t * dx, y: y1 + t * dy };
}

export function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  gap: number,
): boolean {
  return (
    a.x < b.x + b.w + gap &&
    a.x + a.w + gap > b.x &&
    a.y < b.y + b.h + gap &&
    a.y + a.h + gap > b.y
  );
}

export function repelRectFromSegment(s: LayoutRect, seg: RoadSegment, clearance: number): void {
  const samples: [number, number][] = [
    [s.x + s.w / 2, s.y + s.h / 2],
    [s.x + 8, s.y + 8],
    [s.x + s.w - 8, s.y + 8],
    [s.x + 8, s.y + s.h - 8],
    [s.x + s.w - 8, s.y + s.h - 8],
  ];

  for (const [px, py] of samples) {
    const cp = closestPointOnSegment(px, py, seg.x1, seg.y1, seg.x2, seg.y2);
    let dx = px - cp.x;
    let dy = py - cp.y;
    let dist = Math.hypot(dx, dy);
    if (dist < 1e-3) {
      const sdx = seg.x2 - seg.x1;
      const sdy = seg.y2 - seg.y1;
      const segLen = Math.hypot(sdx, sdy) || 1;
      dx = -sdy / segLen;
      dy = sdx / segLen;
      dist = 1;
    }
    if (dist >= clearance) continue;
    const push = ((clearance - dist) / dist) * 0.65;
    s.x += dx * push;
    s.y += dy * push;
  }
}

export function repelRectFromPoint(s: LayoutRect, px: number, py: number, minDist: number): void {
  const rx = Math.max(s.x, Math.min(px, s.x + s.w));
  const ry = Math.max(s.y, Math.min(py, s.y + s.h));
  let dx = rx - px;
  let dy = ry - py;
  let dist = Math.hypot(dx, dy);
  if (dist < 1e-3) {
    dx = s.x + s.w / 2 - px;
    dy = s.y + s.h / 2 - py;
    dist = Math.hypot(dx, dy) || 1;
  }
  if (dist >= minDist) return;
  const push = minDist - dist;
  s.x += (dx / dist) * push;
  s.y += (dy / dist) * push;
}

export function separateRects(a: LayoutRect, b: LayoutRect, gap: number): void {
  if (!rectsOverlap(a, b, gap)) return;

  const acx = a.x + a.w / 2;
  const acy = a.y + a.h / 2;
  const bcx = b.x + b.w / 2;
  const bcy = b.y + b.h / 2;
  const overlapX = (a.w + b.w) / 2 + gap - Math.abs(acx - bcx);
  const overlapY = (a.h + b.h) / 2 + gap - Math.abs(acy - bcy);
  if (overlapX <= 0 || overlapY <= 0) return;

  if (overlapX < overlapY) {
    const push = overlapX + 1;
    const dir = acx >= bcx ? 1 : -1;
    a.x += push * dir * 0.5;
    b.x -= push * dir * 0.5;
  } else {
    const push = overlapY + 1;
    const dir = acy >= bcy ? 1 : -1;
    a.y += push * dir * 0.5;
    b.y -= push * dir * 0.5;
  }
}

export function pushRectsApart(a: LayoutRect, b: LayoutRect, gap: number): void {
  separateRects(a, b, gap);
}
