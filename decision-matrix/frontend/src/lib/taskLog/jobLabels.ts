export const JOB_TYPE_LABELS: Record<string, string> = {
  sand_logistics_analyze: 'Логистика песка',
  poi_analyze_all: 'Анализ окружения',
  autoroad_connect: 'Автодороги / сеть',
  import_file: 'Импорт файла',
  pad_earthwork_compute: 'Земляные работы куста',
  pad_placement_compute: 'Оптимизация кустов',
  pad_placement_apply: 'Применение кустов',
  well_trajectory_compute: 'Anti-collision (SF)',
  well_trajectory_import: 'Импорт инклинометрии',
};

/** Подписи для автоматически созданных HTTP-flow (последние сегменты path). */
export const HTTP_FLOW_PATH_LABELS: Record<string, string> = {
  'pois/analyze-all': 'Анализ окружения',
  'sand-logistics/analyze': 'Логистика песка',
  'infrastructure/autoroad-connect': 'Соединение автодорогами',
  'autoroad-network/request': 'Сеть автодорог: подготовка',
  'autoroad-network/compute': 'Сеть автодорог: расчёт',
  'autoroad-network/apply': 'Сеть автодорог: применение',
  'pad-placement/compute': 'Оптимизация кустов: расчёт',
  'pad-placement/apply': 'Оптимизация кустов: применение',
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
