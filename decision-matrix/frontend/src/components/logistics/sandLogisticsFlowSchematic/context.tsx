import { createContext, useContext } from 'react';
import type { SandLogisticsEdgeLabelMode, SandLogisticsLineStyle } from '../../../lib/sandLogisticsFlow';

export const LineStyleContext = createContext<SandLogisticsLineStyle>('straight');
export const EdgeLabelModeContext = createContext<SandLogisticsEdgeLabelMode>('key');

export function useSandLineStyle(): SandLogisticsLineStyle {
  return useContext(LineStyleContext);
}

export function useSandEdgeLabelMode(): SandLogisticsEdgeLabelMode {
  return useContext(EdgeLabelModeContext);
}
