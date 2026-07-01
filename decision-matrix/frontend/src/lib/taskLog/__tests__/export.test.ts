import { describe, expect, it } from 'vitest';

import { buildExportPayload, exportEntryFilename } from '../export';
import type { TaskLogEntry } from '../types';

describe('taskLog export', () => {
  it('buildExportPayload includes project and entries', () => {
    const entries: TaskLogEntry[] = [
      {
        kind: 'http_flow',
        id: 'f1',
        projectId: 'p1',
        label: 'Test',
        flowKey: 'test',
        status: 'completed',
        startedAt: 1,
        steps: [],
      },
    ];
    const payload = buildExportPayload('p1', entries);
    expect(payload.projectId).toBe('p1');
    expect(payload.entries).toHaveLength(1);
    expect(payload.exportedAt).toBeTruthy();
  });

  it('exportEntryFilename uses job type', () => {
    const entry: TaskLogEntry = {
      kind: 'project_job',
      id: 'j1',
      projectId: 'p1',
      job: {
        id: 'j1',
        project_id: 'p1',
        job_type: 'import_file',
        status: 'completed',
      },
      httpSteps: [],
      updatedAt: 1,
    };
    expect(exportEntryFilename(entry)).toContain('import_file');
  });
});
