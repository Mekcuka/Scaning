import type { SandLogisticsConsumerRow, SandLogisticsResult } from './api';

export type SandHaulLegRow = {
  quarry_id: string;
  quarry_name: string;
  allocated_m3: number;
  distance_km: number | null;
};

export function findSandLogisticsConsumer(
  result: SandLogisticsResult | null | undefined,
  objectId: string,
): SandLogisticsConsumerRow | null {
  if (!result?.subnets?.length) return null;
  for (const subnet of result.subnets) {
    const row = subnet.consumers.find((c) => c.object_id === objectId);
    if (row) return row;
  }
  return null;
}

export function buildHaulLegRows(consumer: SandLogisticsConsumerRow): SandHaulLegRow[] {
  const rows: SandHaulLegRow[] = consumer.proportional_allocations
    .filter((p) => p.allocated_m3 > 0)
    .map((p) => ({
      quarry_id: p.quarry_id,
      quarry_name: p.quarry_name,
      allocated_m3: p.allocated_m3,
      distance_km:
        p.distance_km ??
        consumer.distances_to_quarries_km?.[p.quarry_id] ??
        null,
    }));

  rows.sort((a, b) => {
    const da = a.distance_km ?? Number.POSITIVE_INFINITY;
    const db = b.distance_km ?? Number.POSITIVE_INFINITY;
    return da - db;
  });

  return rows;
}

export function formatHaulLegKm(km: number | null | undefined): string {
  if (km == null) return '—';
  return `${km.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}`;
}

export function formatHaulLegM3(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
}

/** Краткая подпись для таблиц параметров: «2 карьера, 5–20 км». */
export function haulLegSummaryLabel(rows: SandHaulLegRow[]): string | null {
  if (rows.length === 0) return null;
  const n = rows.length;
  const quarryLabel =
    n === 1 ? '1 карьер' : n >= 2 && n <= 4 ? `${n} карьера` : `${n} карьеров`;
  const kms = rows.map((r) => r.distance_km).filter((k): k is number => k != null);
  if (kms.length === 0) return quarryLabel;
  const minKm = Math.min(...kms);
  const maxKm = Math.max(...kms);
  if (minKm === maxKm) return `${quarryLabel}, ${formatHaulLegKm(minKm)} км`;
  return `${quarryLabel}, ${formatHaulLegKm(minKm)}–${formatHaulLegKm(maxKm)} км`;
}

const OBJECT_WARNING_PREFIXES: Record<string, string> = {
  no_path: 'Нет пути по автодорогам до карьера',
  not_in_quarry_subnet: 'Не связан с карьером по автодорогам',
  unmet_demand: 'Неудовлетворённый спрос',
  not_in_service: 'Не введён в эксплуатацию',
  no_graph_node: 'Нет привязки к сети',
  too_far_from_autoroad: 'Дальше 300 м от автодороги',
  not_on_autoroad: 'Объект не на сети автодорог',
};

/** Warnings from subnet result that mention this consumer object id. */
export function consumerSandLogisticsWarnings(
  result: SandLogisticsResult | null | undefined,
  objectId: string,
): string[] {
  if (!result?.subnets?.length) return [];
  const lines: string[] = [];
  for (const subnet of result.subnets) {
    for (const w of subnet.warnings ?? []) {
      const colon = w.indexOf(':');
      if (colon < 0) continue;
      const prefix = w.slice(0, colon);
      const id = w.slice(colon + 1);
      if (id !== objectId) continue;
      const label = OBJECT_WARNING_PREFIXES[prefix];
      if (label) lines.push(label);
    }
  }
  return [...new Set(lines)];
}
