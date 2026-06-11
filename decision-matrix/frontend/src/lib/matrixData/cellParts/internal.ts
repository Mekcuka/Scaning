export function internalMatrixCellParts(item: Record<string, unknown>): {
  text: string;
  subtext?: string;
} {
  if (item.status === 'not_required') {
    return { text: 'Не требуется' };
  }
  const costMln = item.cost_mln;
  const text =
    costMln != null && costMln !== '' ? `${costMln} млн ₽` : '0 млн ₽';
  if (item.subtype === 'pads') {
    const n = item.pads_count;
    return { text, subtext: n != null ? `${n} шт.` : undefined };
  }
  const formula = item.formula_label as string | undefined;
  if (formula) return { text, subtext: formula };
  const dist = item.distance_km;
  return {
    text,
    subtext: dist != null && dist !== '' ? `${dist} км` : undefined,
  };
}
