export const JOB_TYPE_LABELS: Record<string, string> = {
  sand_logistics_analyze: 'Логистика песка',
  poi_analyze_all: 'Анализ POI',
  autoroad_connect: 'Автодороги / сеть',
  import_file: 'Импорт файла',
};

export const JOB_STATUS_LABELS: Record<string, string> = {
  pending: 'В очереди',
  running: 'Выполняется',
  completed: 'Завершена',
  failed: 'Ошибка',
  cancelled: 'Отменена',
};

export const ACTIVE_JOB_STATUSES = new Set(['pending', 'running']);

export function jobTypeLabel(jobType: string): string {
  return JOB_TYPE_LABELS[jobType] ?? jobType;
}

export function jobStatusLabel(status: string): string {
  return JOB_STATUS_LABELS[status] ?? status;
}
