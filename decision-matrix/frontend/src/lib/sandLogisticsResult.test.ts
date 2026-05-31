import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  normalizeSandLogisticsResult,
  sandLogisticsStorageKey,
  saveSandLogisticsToSession,
  loadSandLogisticsFromSession,
  buildSandLogisticsWarningLines,
} from './sandLogisticsResult';

describe('sandLogisticsResult', () => {
  it('sandLogisticsStorageKey is stable per project', () => {
    expect(sandLogisticsStorageKey('p1')).toBe('sand-logistics:p1');
  });

  it('normalizeSandLogisticsResult fills defaults', () => {
    const result = normalizeSandLogisticsResult({
      subnets: [{ quarries: [], consumers: [] }],
      warnings: ['w1'],
    });
    expect(result.subnets).toHaveLength(1);
    expect(result.warnings).toEqual(['w1']);
  });

  it('session round-trip', () => {
    const key = sandLogisticsStorageKey('sess-proj');
    const raw = {
      subnets: [
        {
          subnet_index: 0,
          name: 'S0',
          quarries: [],
          consumers: [],
          autoroad_edge_count: 0,
          quarry_count: 0,
          consumer_count: 0,
          network_nodes: [],
          network_edges: [],
        },
      ],
      warnings: [],
    };
    saveSandLogisticsToSession('sess-proj', normalizeSandLogisticsResult(raw));
    const loaded = loadSandLogisticsFromSession('sess-proj');
    expect(loaded?.subnets).toHaveLength(1);
    sessionStorage.removeItem(key);
  });

  it('buildSandLogisticsWarningLines aggregates global and subnet', () => {
    const result = normalizeSandLogisticsResult({
      warnings: ['global'],
      subnets: [{ warnings: ['subnet'], quarries: [], consumers: [] }],
    });
    const lines = buildSandLogisticsWarningLines(result);
    expect(lines.some((l) => l.includes('global'))).toBe(true);
  });
});
