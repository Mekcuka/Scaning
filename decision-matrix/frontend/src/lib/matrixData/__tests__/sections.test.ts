import { describe, expect, it } from 'vitest';
import { MATRIX_SECTIONS } from '../sections';

describe('MATRIX_SECTIONS registry', () => {
  it('covers internal, external_linear and external param types', () => {
    const paramTypes = MATRIX_SECTIONS.map((s) => s.paramType);
    expect(paramTypes).toContain('internal');
    expect(paramTypes).toContain('external_linear');
    expect(paramTypes).toContain('external');
  });

  it('includes pads in internal section', () => {
    const internal = MATRIX_SECTIONS.find((s) => s.paramType === 'internal');
    expect(internal?.subtypes).toContain('pads');
    expect(internal?.labelOf?.('pads')).toBe('Кустовые площадки');
  });

  it('excludes connection nodes from external point section', () => {
    const external = MATRIX_SECTIONS.find((s) => s.paramType === 'external');
    expect(external?.subtypes).not.toContain('node');
    expect(external?.subtypes).not.toContain('oil_pad');
    expect(external?.subtypes).not.toContain('gas_pad');
    expect(external?.subtypes).not.toContain('methanol_joint');
    expect(external?.subtypes).not.toContain('power_line_node');
  });

  it('excludes additional_line from external linear section', () => {
    const externalLinear = MATRIX_SECTIONS.find((s) => s.paramType === 'external_linear');
    expect(externalLinear?.subtypes).not.toContain('additional_line');
    expect(externalLinear?.subtypes).toContain('methanol_pipeline');
  });
});
