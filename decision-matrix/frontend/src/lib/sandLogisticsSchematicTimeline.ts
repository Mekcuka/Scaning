import type { SandLogisticsSubnet } from './api';
import { yearEndIso } from './sandLogisticsResult';

export type SchematicTimelineMarker = {
  objectId: string;
  name: string;
  kind: 'quarry' | 'consumer';
  entryDate: string;
  year: number;
};

export function collectSubnetEntryMarkers(subnet: SandLogisticsSubnet): SchematicTimelineMarker[] {
  const markers: SchematicTimelineMarker[] = [];
  for (const q of subnet.quarries) {
    if (!q.entry_date) continue;
    const year = Number.parseInt(q.entry_date.slice(0, 4), 10);
    if (!Number.isFinite(year)) continue;
    markers.push({
      objectId: q.object_id,
      name: q.name || 'Карьер',
      kind: 'quarry',
      entryDate: q.entry_date,
      year,
    });
  }
  for (const c of subnet.consumers) {
    if (!c.entry_date) continue;
    const year = Number.parseInt(c.entry_date.slice(0, 4), 10);
    if (!Number.isFinite(year)) continue;
    markers.push({
      objectId: c.object_id,
      name: c.name || c.subtype || 'Потребитель',
      kind: 'consumer',
      entryDate: c.entry_date,
      year,
    });
  }
  return markers.sort(
    (a, b) => a.entryDate.localeCompare(b.entryDate) || a.name.localeCompare(b.name, 'ru'),
  );
}

export function yearsInHorizon(horizonFrom: string, horizonTo: string): number[] {
  const fromYear = Number.parseInt(horizonFrom.slice(0, 4), 10);
  const toYear = Number.parseInt(horizonTo.slice(0, 4), 10);
  if (!Number.isFinite(fromYear) || !Number.isFinite(toYear)) return [];
  const start = Math.min(fromYear, toYear);
  const end = Math.max(fromYear, toYear);
  const years: number[] = [];
  for (let y = start; y <= end; y += 1) years.push(y);
  return years;
}

export function datePositionPct(dateIso: string, horizonFrom: string, horizonTo: string): number {
  const fromMs = Date.parse(horizonFrom);
  const toMs = Date.parse(horizonTo);
  const dateMs = Date.parse(dateIso);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || !Number.isFinite(dateMs)) return 50;
  if (toMs <= fromMs) return 50;
  const pct = ((dateMs - fromMs) / (toMs - fromMs)) * 100;
  return Math.min(100, Math.max(0, pct));
}

export function viewAsOfForYear(year: number): string {
  return yearEndIso(year);
}

export function yearIndexInHorizon(viewAsOf: string, years: number[]): number {
  const viewYear = Number.parseInt(viewAsOf.slice(0, 4), 10);
  const idx = years.indexOf(viewYear);
  return idx >= 0 ? idx : Math.max(0, years.length - 1);
}
