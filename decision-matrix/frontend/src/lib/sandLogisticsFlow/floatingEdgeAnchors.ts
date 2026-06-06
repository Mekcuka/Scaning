import { Position } from '@xyflow/react';
import { NET_SIZE, SITE_H, SITE_W } from './constants';
import type { EdgePathInput } from './types';

export type SandFlowNodeBox = {
  type?: string;
  measured?: { width?: number; height?: number };
  internals: { positionAbsolute: { x: number; y: number } };
};

export function sandFlowNodeDimensions(node: SandFlowNodeBox): { w: number; h: number } {
  if (node.type === 'sandNetworkNode') {
    return { w: NET_SIZE, h: NET_SIZE };
  }
  return {
    w: node.measured?.width ?? SITE_W,
    h: node.measured?.height ?? SITE_H,
  };
}

function nodeCenter(node: SandFlowNodeBox): { x: number; y: number } {
  const pos = node.internals.positionAbsolute;
  const { w, h } = sandFlowNodeDimensions(node);
  return { x: pos.x + w / 2, y: pos.y + h / 2 };
}

/** Точка на границе прямоугольника блока в направлении toward. */
export function borderAnchorToward(
  node: SandFlowNodeBox,
  toward: { x: number; y: number },
): { x: number; y: number; position: Position } {
  const pos = node.internals.positionAbsolute;
  const { w, h } = sandFlowNodeDimensions(node);
  const cx = pos.x + w / 2;
  const cy = pos.y + h / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;

  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    return { x: pos.x + w, y: cy, position: Position.Right };
  }

  const scale = Math.min(
    Math.abs(dx) > 1e-6 ? w / 2 / Math.abs(dx) : Infinity,
    Math.abs(dy) > 1e-6 ? h / 2 / Math.abs(dy) : Infinity,
  );
  const x = cx + dx * scale;
  const y = cy + dy * scale;
  const position =
    Math.abs(dx) * (h / 2) > Math.abs(dy) * (w / 2)
      ? dx > 0
        ? Position.Right
        : Position.Left
      : dy > 0
        ? Position.Bottom
        : Position.Top;

  return { x, y, position };
}

/** Концы site-link: от ближайшей грани source к ближайшей грани target. */
export function floatingSandSiteLinkEndpoints(
  sourceNode: SandFlowNodeBox,
  targetNode: SandFlowNodeBox,
): Pick<
  EdgePathInput,
  'sourceX' | 'sourceY' | 'targetX' | 'targetY' | 'sourcePosition' | 'targetPosition'
> {
  const targetCenter = nodeCenter(targetNode);
  const sourceCenter = nodeCenter(sourceNode);
  const source = borderAnchorToward(sourceNode, targetCenter);
  const target = borderAnchorToward(targetNode, sourceCenter);
  return {
    sourceX: source.x,
    sourceY: source.y,
    targetX: target.x,
    targetY: target.y,
    sourcePosition: source.position,
    targetPosition: target.position,
  };
}
