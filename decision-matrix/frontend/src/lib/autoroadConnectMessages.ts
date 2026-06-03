import type { AutoroadConnectResult } from './api';

const WARNING_LABELS: Record<string, string> = {
  no_autoroad_polylines:
    'На карте нет существующих автодорог — будут созданы новые участки (MST-дерево с узлами на стыках).',
  no_graph_edges_from_polylines:
    'Линии дорог на карте есть, но граф сети не построен — проверьте геометрию.',
  terminals_not_connected: 'Не удалось связать все выбранные объекты в одну сеть.',
  need_at_least_two_terminals: 'Нужно выбрать не меньше двух объектов.',
  insufficient_snapped_terminals: 'Недостаточно объектов с привязкой к сети для соединения.',
  far_from_autoroad: 'Далеко от ближайшей автодороги (> 0,3 км)',
  already_connected: 'Уже подключён к существующей дороге',
};

export function formatAutoroadWarning(code: string): string {
  const base = code.split(':')[0] ?? code;
  if (WARNING_LABELS[base]) return WARNING_LABELS[base];
  if (base === 'too_many_terminals_max') return 'Слишком много объектов в выборе';
  if (base === 'excluded_terminal_subtype') return 'В выборе есть недопустимый тип (узел / ЛЭП)';
  if (base === 'multiple_autoroad_connections') return 'К одному объекту привязано больше одной дороги';
  return code;
}

export type AutoroadPreviewSummary = {
  newLineCount: number;
  newNodeCount: number;
  splitCount: number;
  totalNewKm: number;
  planWarnings: string[];
  terminalWarningCount: number;
  terminalWarningLabels: string[];
};

export function buildAutoroadPreviewSummary(preview: AutoroadConnectResult): AutoroadPreviewSummary {
  const terminalLabels = new Set<string>();
  for (const t of preview.terminals) {
    if (t.warning) terminalLabels.add(formatAutoroadWarning(t.warning));
  }
  const planWarnings = preview.warnings.map(formatAutoroadWarning);
  return {
    newLineCount: preview.new_line_count,
    newNodeCount: preview.new_node_count,
    splitCount: preview.split_count,
    totalNewKm: preview.total_new_km,
    planWarnings,
    terminalWarningCount: preview.terminals.filter((t) => t.warning).length,
    terminalWarningLabels: [...terminalLabels],
  };
}
