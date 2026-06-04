import type { TaskLogEntry, TaskLogExportPayload } from './types';

export function buildExportPayload(projectId: string, entries: TaskLogEntry[]): TaskLogExportPayload {
  return {
    exportedAt: new Date().toISOString(),
    projectId,
    entries,
  };
}

export function downloadTaskLogJson(
  filename: string,
  payload: TaskLogExportPayload | TaskLogExportPayload['entries'],
): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportEntryFilename(entry: TaskLogEntry): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (entry.kind === 'project_job') {
    return `task-${entry.job.job_type}-${entry.id.slice(0, 8)}-${stamp}.json`;
  }
  return `task-${entry.flowKey}-${stamp}.json`;
}
