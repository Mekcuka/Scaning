import { LINE_SUBTYPES, SUBTYPE_LABELS } from '../../lib/api';
import {
  FOOTPRINT_CARDINAL_OPTIONS,
  type FootprintCardinalAttachTemplate,
  type FootprintLineConnectionTemplate,
} from '../../lib/padFootprintLineAttach';

export const LINE_PREVIEW_PALETTE = [
  '#64748b',
  '#b45309',
  '#dc2626',
  '#2563eb',
  '#ca8a04',
  '#7c3aed',
  '#0d9488',
  '#db2777',
];

export function linePreviewColor(lineSubtype: string): string {
  const idx = LINE_SUBTYPES.indexOf(lineSubtype as (typeof LINE_SUBTYPES)[number]);
  return LINE_PREVIEW_PALETTE[(idx >= 0 ? idx : 0) % LINE_PREVIEW_PALETTE.length]!;
}

const CARDINAL_LABEL: Record<string, string> = Object.fromEntries(
  FOOTPRINT_CARDINAL_OPTIONS.map((o) => [o.value, o.label]),
);

export function templateEntryBadgeLabel(
  template: FootprintLineConnectionTemplate,
  lineSubtype: string,
): string {
  if (!(lineSubtype in template)) return '—';
  const entry = template[lineSubtype];
  if (entry == null) return 'К центру';
  return CARDINAL_LABEL[entry.cardinal] ?? entry.cardinal;
}

export function templateEntrySummary(
  entry: FootprintCardinalAttachTemplate | null | undefined,
): string {
  if (entry === undefined) return 'Не задано';
  if (entry === null) return 'К центру площадки';
  const side = CARDINAL_LABEL[entry.cardinal] ?? entry.cardinal;
  const t = entry.t ?? 0.5;
  return `${side}, позиция ${t.toFixed(2)}`;
}

export function configuredTemplateCount(template: FootprintLineConnectionTemplate): number {
  return Object.keys(template).length;
}

export function templateSummaryLines(template: FootprintLineConnectionTemplate): {
  lineSubtype: string;
  label: string;
  summary: string;
  color: string;
}[] {
  return LINE_SUBTYPES.filter((st) => st in template).map((st) => ({
    lineSubtype: st,
    label: SUBTYPE_LABELS[st] ?? st,
    summary: templateEntrySummary(template[st]),
    color: linePreviewColor(st),
  }));
}
