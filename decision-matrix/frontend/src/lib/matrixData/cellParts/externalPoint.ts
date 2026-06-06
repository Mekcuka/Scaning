import { formatExternalDistanceBlock } from '../../analysisDisplay';

function externalDistanceSubtext(item: Record<string, unknown>, extraParts: string[] = []): string {
  return formatExternalDistanceBlock(
    {
      distance_km: item.distance_km as number | string | null | undefined,
      limit_km: item.limit_km as number | string | null | undefined,
    },
    extraParts
  );
}

function externalCostSubtext(item: Record<string, unknown>): string {
  const costMln = item.cost_mln;
  if (costMln != null && costMln !== '' && Number(costMln) > 0) return `${costMln} млн ₽`;
  return '';
}

export function externalPointMatrixCellParts(item: Record<string, unknown>): {
  text: string;
  subtext?: string;
} {
  const st = String(item.status || '');
  if (st === 'not_required') return { text: 'Не треб.' };
  const name = item.object_name != null ? String(item.object_name).trim() : '';
  const cost = externalCostSubtext(item);
  const distBlock = externalDistanceSubtext(item, cost ? [cost] : []);

  if (st === 'construction_required') {
    return { text: name || 'Строительство', subtext: distBlock };
  }
  if (st === 'within_limit') {
    if (name) return { text: name, subtext: distBlock };
    return { text: 'В пределах', subtext: distBlock };
  }
  if (st === 'exceeds_limit') {
    if (name) return { text: name, subtext: distBlock };
    return { text: distBlock };
  }
  if (name) return { text: name, subtext: distBlock };
  return { text: distBlock };
}
