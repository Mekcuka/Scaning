export const THRESHOLD_META: { subtype: string; color: string; label: string; defaultKm: number }[] = [
  { subtype: 'gas_processing', color: '#ff6f00', label: 'ГКС', defaultKm: 80 },
  { subtype: 'gtes', color: '#d84315', label: 'ИЭ', defaultKm: 60 },
  { subtype: 'substation', color: '#f9a825', label: 'ПС/ТП', defaultKm: 25 },
  { subtype: 'refinery', color: '#455a64', label: 'НПЗ', defaultKm: 100 },
];

export const MOVE_MATCH_EPS = 1e-6;
