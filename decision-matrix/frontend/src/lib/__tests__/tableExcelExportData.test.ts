import { describe, expect, it } from 'vitest';
import {
  capacityTableExportColumns,
  trajectoryProfileExportFilename,
  trajectoryProfileTableExportColumns,
} from '../tableExcelExportData';
import { makeInfraPoint } from '../../test/fixtures/infra';

describe('tableExcelExportData', () => {
  it('capacityTableExportColumns maps infra object fields', () => {
    const obj = makeInfraPoint({ name: 'GKS-1', subtype: 'gas_processing' });
    const cols = capacityTableExportColumns();
    expect(cols.length).toBeGreaterThan(0);
    const nameCol = cols.find((c) => c.header === 'Объект');
    expect(nameCol?.value(obj)).toBe('GKS-1');
  });

  it('trajectoryProfileTableExportColumns exports numeric station fields', () => {
    const cols = trajectoryProfileTableExportColumns();
    const point = { md: 100, tvd: 99.5, inc: 12, azi: 180, dls: 3, n: -1.2, e: 0.5 };
    expect(cols.find((c) => c.header === 'MD, м')?.value(point)).toBe(100);
    expect(cols.find((c) => c.header === 'DLS, °/30 м')?.value(point)).toBe(3);
  });

  it('trajectoryProfileExportFilename includes pad and subject', () => {
    expect(trajectoryProfileExportFilename('Куст A', 'Скв-1')).toMatch(/traektoriya-stancii.*\.xlsx$/);
  });
});
