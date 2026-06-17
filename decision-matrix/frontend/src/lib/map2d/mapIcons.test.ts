import { describe, expect, it } from 'vitest';
import { iconDataUrl, MAP_SUBTYPE_COLORS } from './mapIcons';

describe('mapIcons', () => {
  it('uses different colors for oil_pad and gas_pad', () => {
    expect(MAP_SUBTYPE_COLORS.oil_pad).not.toBe(MAP_SUBTYPE_COLORS.gas_pad);
    expect(iconDataUrl('oil_pad')).not.toBe(iconDataUrl('gas_pad'));
  });

  it('maps legacy pad to oil_pad icon color', () => {
    expect(iconDataUrl('pad')).toBe(iconDataUrl('oil_pad'));
  });

  it('node icon is a 15px black filled circle', () => {
    const svg = decodeURIComponent(iconDataUrl('node').replace('data:image/svg+xml;charset=utf-8,', ''));
    expect(svg).toContain('width="15"');
    expect(svg).toContain('height="15"');
    expect(svg).toContain('fill="#000"');
    expect(svg).toContain('r="4.9"');
  });
});
