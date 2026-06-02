import { describe, expect, it } from 'vitest';
import {
  buildGlobalSandLogisticsWarningLines,
  buildSandLogisticsWarningLines,
  normalizeSandLogisticsResult,
  resolveSubnetsAtView,
  resolveSubnetForSchematicAtView,
  clearSchematicSliceCache,
  horizonYearRange,
  sandLogisticsStorageKey,
  hasLegacySandLogisticsSession,
} from './sandLogisticsResult';
import type { SandLogisticsResult } from './api';
import { complexSandLogisticsResult, mainQuarrySubnet } from '../test/fixtures/sandLogisticsFixtures';

describe('sandLogisticsResult', () => {
  it('sandLogisticsStorageKey is stable per project', () => {
    expect(sandLogisticsStorageKey('p1')).toBe('sand-logistics:p1');
  });

  it('loadSandLogisticsAsOf round-trip', async () => {
    const { loadSandLogisticsAsOf, saveSandLogisticsAsOf, sandLogisticsAsOfKey } =
      await import('./sandLogisticsResult');
    saveSandLogisticsAsOf('asof-proj', '2026-05-15');
    expect(loadSandLogisticsAsOf('asof-proj')).toBe('2026-05-15');
    sessionStorage.removeItem(sandLogisticsAsOfKey('asof-proj'));
  });

  it('normalizeSandLogisticsResult fills defaults', () => {
    const result = normalizeSandLogisticsResult({
      subnets: [{ quarries: [], consumers: [] }],
      warnings: ['w1'],
    });
    expect(result.subnets).toHaveLength(1);
    expect(result.warnings).toEqual(['w1']);
  });

  it('normalizeSandLogisticsResult includes calculated_at', () => {
    const result = normalizeSandLogisticsResult({
      subnets: [{ quarries: [], consumers: [] }],
      warnings: ['w1'],
      calculated_at: '2025-06-01T10:00:00Z',
    });
    expect(result.calculated_at).toBe('2025-06-01T10:00:00Z');
  });

  it('hasLegacySandLogisticsSession detects old session key', () => {
    const key = sandLogisticsStorageKey('sess-proj');
    sessionStorage.setItem(key, '{}');
    expect(hasLegacySandLogisticsSession('sess-proj')).toBe(true);
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

  it('normalizeSandLogisticsResult legacy without timeline', () => {
    const result = normalizeSandLogisticsResult({
      as_of: '2025-06-01',
      subnets: [{ subnet_index: 1, quarries: [], consumers: [] }],
    });
    expect(result.horizon_from).toBe('2025-06-01');
    expect(result.horizon_to).toBe('2025-06-01');
    expect(result.timeline).toEqual([]);
  });

  it('resolveSubnetsAtView picks timeline step', () => {
    const result = normalizeSandLogisticsResult({
      horizon_from: '2024-01-01',
      horizon_to: '2025-12-31',
      as_of: '2025-12-31',
      subnets: [{ subnet_index: 1, name: 'Final', quarries: [], consumers: [] }],
      timeline: [
        {
          year: 2024,
          as_of: '2024-12-31',
          subnet_count: 1,
          total_demand_m3: 0,
          total_allocated_m3: 0,
          unmet_m3: 0,
          subnets: [{ subnet_index: 1, name: 'Y2024', quarries: [], consumers: [] }],
        },
        {
          year: 2025,
          as_of: '2025-12-31',
          subnet_count: 1,
          total_demand_m3: 0,
          total_allocated_m3: 0,
          unmet_m3: 0,
          subnets: [{ subnet_index: 1, name: 'Y2025', quarries: [], consumers: [] }],
        },
      ],
    }) as SandLogisticsResult;
    const early = resolveSubnetsAtView(result, '2024-12-31');
    expect(early[0]?.name).toBe('Y2024');
    expect(horizonYearRange(result)).toEqual([2024, 2025]);
  });

  it('buildGlobalSandLogisticsWarningLines groups object warnings by type', () => {
    const result = complexSandLogisticsResult();
    const lines = buildGlobalSandLogisticsWarningLines(result);
    expect(lines.some((l) => l.includes('Неудовлетворённый спрос'))).toBe(true);
    expect(lines.some((l) => l.includes('Нет привязки к сети'))).toBe(true);
    expect(lines.some((l) => l.includes('ГКС_3'))).toBe(true);
  });

  it('resolveSubnetsAtView returns waiting subnet for early timeline year', () => {
    const result = complexSandLogisticsResult();
    const subnets2019 = resolveSubnetsAtView(result, '2019-12-31');
    expect(subnets2019).toHaveLength(1);
    expect(subnets2019[0]?.name).toContain('ГКС_3');
  });

  it('resolveSubnetsAtView returns both subnets for later timeline year', () => {
    const result = complexSandLogisticsResult();
    const subnets2023 = resolveSubnetsAtView(result, '2023-12-31');
    expect(subnets2023).toHaveLength(2);
  });

  it('resolveSubnetForSchematicAtView keeps full topology when timeline slice is sparse', () => {
    const result = complexSandLogisticsResult();
    const canonical = mainQuarrySubnet();
    const at2019 = resolveSubnetForSchematicAtView(result, canonical, '2019-12-31');

    expect(at2019.network_nodes.length).toBeGreaterThan(0);
    expect(at2019.quarries.length).toBe(canonical.quarries.length);
    expect(at2019.consumers.length).toBe(canonical.consumers.length);
    expect(at2019.quarries.every((q) => !q.in_service)).toBe(true);
    expect(at2019.consumers.every((c) => !c.in_service)).toBe(true);
  });

  it('resolveSubnetForSchematicAtView applies timeline volumes for in-service objects', () => {
    const result = complexSandLogisticsResult();
    const canonical = mainQuarrySubnet();
    const at2023 = resolveSubnetForSchematicAtView(result, canonical, '2023-12-31');
    const timeline2023 = resolveSubnetsAtView(result, '2023-12-31').find((s) => s.subnet_index === 1);

    expect(timeline2023).toBeTruthy();
    const q2 = at2023.quarries.find((q) => q.object_id === 'q2');
    const timelineQ2 = timeline2023!.quarries.find((q) => q.object_id === 'q2');
    expect(q2?.in_service).toBe(true);
    expect(q2?.greedy_allocated_m3).toBe(timelineQ2?.greedy_allocated_m3);
  });

  it('resolveSubnetForSchematicAtView reuses cache for same key', () => {
    const result = complexSandLogisticsResult();
    clearSchematicSliceCache();
    const first = resolveSubnetForSchematicAtView(result, mainQuarrySubnet(), '2019-12-31');
    const second = resolveSubnetForSchematicAtView(result, mainQuarrySubnet(), '2019-12-31');
    expect(second).toBe(first);
  });

  it('buildSandLogisticsWarningLines includes subnet warnings', () => {
    const result = complexSandLogisticsResult();
    const lines = buildSandLogisticsWarningLines(result);
    expect(lines.length).toBeGreaterThan(0);
  });
});
