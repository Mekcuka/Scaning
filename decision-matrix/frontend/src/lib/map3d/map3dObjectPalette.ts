import * as THREE from 'three';

export type PaletteRole = 'pad' | 'body' | 'roof' | 'accent' | 'trim';

export type Map3dObjectPalette = Record<PaletteRole, THREE.Color>;

function hexToThreeColor(hex: string): THREE.Color {
  try {
    return new THREE.Color(hex);
  } catch {
    return new THREE.Color('#78909c');
  }
}

function hslFrom(hex: string): { h: number; s: number; l: number } {
  const c = hexToThreeColor(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  hsl.s = Math.min(1, hsl.s * 1.2 + 0.1);
  hsl.l = Math.min(0.55, Math.max(0.32, hsl.l));
  return hsl;
}

function colorHsl(h: number, s: number, l: number): THREE.Color {
  return new THREE.Color().setHSL(h % 1, Math.min(1, Math.max(0, s)), Math.min(1, Math.max(0, l)));
}

/** Strong five-tone palette from layer/subtype color. */
export function buildObjectColorPalette(colorHex: string): Map3dObjectPalette {
  const { h, s, l } = hslFrom(colorHex);
  return {
    pad: colorHsl(h, s * 0.85, l * 0.38),
    body: colorHsl(h, s, l),
    roof: colorHsl(h, s * 0.75, Math.min(0.88, l + 0.32)),
    accent: colorHsl(h + 0.07, Math.min(1, s + 0.25), Math.min(0.72, l + 0.08)),
    trim: colorHsl(h + 0.52, s * 0.55, Math.min(0.92, l + 0.38)),
  };
}

export function paletteRoleForMesh(
  meshName: string,
  normalizedCenterY: number,
  meshIndex: number,
): PaletteRole {
  const n = meshName.toLowerCase();
  if (n.includes('chimney') || n.includes('stack')) return 'accent';
  if (n.includes('detail-tank') || (n.includes('tank') && !n.includes('building'))) return 'body';
  if (normalizedCenterY < 0.12) return 'pad';
  if (normalizedCenterY > 0.88) return 'trim';
  if (normalizedCenterY > 0.68) return 'roof';
  if (normalizedCenterY > 0.48 || meshIndex % 5 === 4) return 'accent';
  return 'body';
}
