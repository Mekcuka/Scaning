import type {
  SandLogisticsEdgeLabelMode,
  SandLogisticsLineStyle,
  SandLogisticsNodeFilterMode,
} from '../sandLogisticsFlow';
import { todayIsoLocal } from '../infraEntryDate';

export function activeSubnetStorageKey(projectId: string): string {
  return `sand-logistics:active-subnet:${projectId}`;
}

export function loadActiveSubnetIndex(projectId: string, maxIndex: number): number {
  try {
    const raw = sessionStorage.getItem(activeSubnetStorageKey(projectId));
    const n = raw != null ? Number(raw) : 0;
    if (!Number.isFinite(n) || n < 0 || n > maxIndex) return 0;
    return n;
  } catch {
    return 0;
  }
}

export function saveActiveSubnetIndex(projectId: string, index: number): void {
  try {
    sessionStorage.setItem(activeSubnetStorageKey(projectId), String(index));
  } catch {
    /* quota / private mode */
  }
}

export function sandLogisticsLineStyleKey(projectId: string): string {
  return `sand-logistics:line-style:${projectId}`;
}

const VALID_LINE_STYLES = new Set<SandLogisticsLineStyle>(['straight', 'bezier', 'smoothstep']);

export function loadSandLogisticsLineStyle(projectId: string): SandLogisticsLineStyle {
  try {
    const raw = sessionStorage.getItem(sandLogisticsLineStyleKey(projectId));
    if (raw && VALID_LINE_STYLES.has(raw as SandLogisticsLineStyle)) {
      return raw as SandLogisticsLineStyle;
    }
  } catch {
    /* ignore */
  }
  return 'straight';
}

export function saveSandLogisticsLineStyle(
  projectId: string,
  style: SandLogisticsLineStyle
): void {
  try {
    sessionStorage.setItem(sandLogisticsLineStyleKey(projectId), style);
  } catch {
    /* quota / private mode */
  }
}

export function sandLogisticsEdgeLabelModeKey(projectId: string): string {
  return `sand-logistics:edge-labels:${projectId}`;
}

const VALID_EDGE_LABEL_MODES = new Set<SandLogisticsEdgeLabelMode>(['all', 'key', 'hidden']);

export function loadSandLogisticsEdgeLabelMode(projectId: string): SandLogisticsEdgeLabelMode {
  try {
    const raw = sessionStorage.getItem(sandLogisticsEdgeLabelModeKey(projectId));
    if (raw && VALID_EDGE_LABEL_MODES.has(raw as SandLogisticsEdgeLabelMode)) {
      return raw as SandLogisticsEdgeLabelMode;
    }
  } catch {
    /* ignore */
  }
  return 'key';
}

export function saveSandLogisticsEdgeLabelMode(
  projectId: string,
  mode: SandLogisticsEdgeLabelMode
): void {
  try {
    sessionStorage.setItem(sandLogisticsEdgeLabelModeKey(projectId), mode);
  } catch {
    /* quota / private mode */
  }
}

export function sandLogisticsHorizonToKey(projectId: string): string {
  return `sand-logistics-horizon-to:${projectId}`;
}

export function loadSandLogisticsHorizonTo(projectId: string): string | null {
  try {
    const raw = sessionStorage.getItem(sandLogisticsHorizonToKey(projectId));
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveSandLogisticsHorizonTo(projectId: string, horizonTo: string): void {
  try {
    sessionStorage.setItem(sandLogisticsHorizonToKey(projectId), horizonTo);
  } catch {
    /* quota / private mode */
  }
}

export function sandLogisticsViewAsOfKey(projectId: string): string {
  return `sand-logistics-view-as-of:${projectId}`;
}

export function loadSandLogisticsViewAsOf(projectId: string, fallback: string): string {
  try {
    const raw = sessionStorage.getItem(sandLogisticsViewAsOfKey(projectId));
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function saveSandLogisticsViewAsOf(projectId: string, viewAsOf: string): void {
  try {
    sessionStorage.setItem(sandLogisticsViewAsOfKey(projectId), viewAsOf);
  } catch {
    /* quota / private mode */
  }
}

export function sandLogisticsAsOfKey(projectId: string): string {
  return `sand-logistics-as-of:${projectId}`;
}

export function loadSandLogisticsAsOf(projectId: string): string {
  try {
    const raw = sessionStorage.getItem(sandLogisticsAsOfKey(projectId));
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  } catch {
    /* ignore */
  }
  return todayIsoLocal();
}

export function saveSandLogisticsAsOf(projectId: string, asOf: string): void {
  try {
    sessionStorage.setItem(sandLogisticsAsOfKey(projectId), asOf);
  } catch {
    /* quota / private mode */
  }
}

export function sandLogisticsNodeFilterKey(projectId: string): string {
  return `sand-logistics:node-filter:${projectId}`;
}

const VALID_NODE_FILTERS = new Set<SandLogisticsNodeFilterMode>([
  'all_planned',
  'in_service',
  'allocated_only',
]);

export function loadSandLogisticsNodeFilterMode(projectId: string): SandLogisticsNodeFilterMode {
  try {
    const raw = sessionStorage.getItem(sandLogisticsNodeFilterKey(projectId));
    if (raw && VALID_NODE_FILTERS.has(raw as SandLogisticsNodeFilterMode)) {
      return raw as SandLogisticsNodeFilterMode;
    }
  } catch {
    /* ignore */
  }
  return 'all_planned';
}

export function saveSandLogisticsNodeFilterMode(
  projectId: string,
  mode: SandLogisticsNodeFilterMode,
): void {
  try {
    sessionStorage.setItem(sandLogisticsNodeFilterKey(projectId), mode);
  } catch {
    /* quota / private mode */
  }
}

export function sandLogisticsShowPlannedRoutesKey(projectId: string): string {
  return `sand-logistics:planned-routes:${projectId}`;
}

export function loadSandLogisticsShowPlannedRoutes(projectId: string): boolean {
  try {
    const raw = sessionStorage.getItem(sandLogisticsShowPlannedRoutesKey(projectId));
    if (raw === '0') return false;
    if (raw === '1') return true;
  } catch {
    /* ignore */
  }
  return true;
}

export function saveSandLogisticsShowPlannedRoutes(projectId: string, value: boolean): void {
  try {
    sessionStorage.setItem(sandLogisticsShowPlannedRoutesKey(projectId), value ? '1' : '0');
  } catch {
    /* quota / private mode */
  }
}

export function sandLogisticsGroupByEntryYearKey(projectId: string): string {
  return `sand-logistics:group-by-year:${projectId}`;
}

export function loadSandLogisticsGroupByEntryYear(projectId: string): boolean {
  try {
    return sessionStorage.getItem(sandLogisticsGroupByEntryYearKey(projectId)) === '1';
  } catch {
    /* ignore */
  }
  return false;
}

export function saveSandLogisticsGroupByEntryYear(projectId: string, value: boolean): void {
  try {
    sessionStorage.setItem(sandLogisticsGroupByEntryYearKey(projectId), value ? '1' : '0');
  } catch {
    /* quota / private mode */
  }
}
