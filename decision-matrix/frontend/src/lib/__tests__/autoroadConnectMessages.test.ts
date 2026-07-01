import { describe, expect, it } from 'vitest';
import { buildAutoroadPreviewSummary, formatAutoroadWarning } from '../autoroadConnectMessages';
import type { AutoroadConnectResult } from '../api';

describe('autoroadConnectMessages', () => {
  it('translates known warning codes', () => {
    expect(formatAutoroadWarning('no_autoroad_polylines')).toContain('нет существующих автодорог');
    expect(formatAutoroadWarning('far_from_autoroad')).toContain('0,3 км');
  });

  it('builds preview summary', () => {
    const preview: AutoroadConnectResult = {
      dry_run: true,
      terminals: [
        { object_id: 'a', warning: 'far_from_autoroad' },
        { object_id: 'b', warning: null },
      ],
      new_line_count: 14,
      new_node_count: 1,
      split_count: 0,
      used_existing_edge_ids: [],
      total_new_km: 164.2,
      warnings: ['no_autoroad_polylines'],
      created_node_ids: [],
      created_line_ids: [],
      created_nodes: 0,
      created_lines: 0,
    };
    const s = buildAutoroadPreviewSummary(preview);
    expect(s.newLineCount).toBe(14);
    expect(s.planWarnings[0]).toContain('нет существующих автодорог');
    expect(s.terminalWarningCount).toBe(1);
  });
});
