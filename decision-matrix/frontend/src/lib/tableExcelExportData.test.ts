import { describe, expect, it } from 'vitest';
import { capacityTableExportColumns } from './tableExcelExportData';
import { makeInfraPoint } from '../test/fixtures/infra';

describe('tableExcelExportData', () => {
  it('capacityTableExportColumns maps infra object fields', () => {
    const obj = makeInfraPoint({ name: 'GKS-1', subtype: 'gas_processing' });
    const cols = capacityTableExportColumns();
    expect(cols.length).toBeGreaterThan(0);
    const nameCol = cols.find((c) => c.header === 'Объект');
    expect(nameCol?.value(obj)).toBe('GKS-1');
  });
});
