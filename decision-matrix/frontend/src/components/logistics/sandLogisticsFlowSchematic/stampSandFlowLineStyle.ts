import type { Edge } from '@xyflow/react';
import type { SandLogisticsLineStyle } from '../../../lib/sandLogisticsFlow';

export function stampSandFlowLineStyle(edges: Edge[], style: SandLogisticsLineStyle): Edge[] {
  return edges.map((edge) => ({
    ...edge,
    data: { ...(edge.data ?? {}), lineStyleKey: style },
  }));
}
