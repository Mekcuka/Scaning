import { stripProjectPrefix } from '../projectRoutes';

export const TOOL_LABELS_RU: Record<string, string> = {
  get_me: 'Текущий пользователь',
  get_assistant_status: 'Статус AI-помощника',
  get_autoroad_solver_status: 'Статус расчёта автодорог',
  list_projects: 'Список проектов',
  create_project: 'Создать проект',
  create_poi: 'Создать POI',
  get_project: 'Данные проекта',
  get_distance_defaults: 'Пороги расстояний проекта',
  list_pois: 'Список POI',
  get_poi: 'Карточка POI (инженерные решения)',
  list_infra_layers: 'Слои карты',
  list_infra_objects: 'Объекты инфраструктуры',
  update_infra_object: 'Изменить объект инфраструктуры',
  get_poi_analysis: 'Анализ POI',
  get_poi_candidates: 'Кандидаты инфраструктуры',
  analyze_poi: 'Анализ одного POI',
  start_analyze_all_pois: 'Запустить анализ всех POI',
  update_cost_rates: 'Обновить тарифы проекта',
  batch_delete_map_objects: 'Удалить объекты на карте',
  admin_list_assistant_audit: 'Журнал assistant (админ)',
  get_project_job: 'Статус фоновой задачи',
  list_project_jobs: 'Журнал задач проекта',
  cancel_project_job: 'Отменить фоновую задачу',
  get_sand_logistics_result: 'Результат логистики песка',
  get_flow_schematic: 'Схема потоков',
  get_cost_rates: 'Тарифы проекта',
  get_economic_params: 'Экономические параметры',
  list_networks: 'Графовые сети',
  list_network_nodes: 'Узлы сети',
  list_network_edges: 'Рёбра сети',
  list_one_pagers: 'One-pager отчёты',
  get_one_pager: 'One-pager отчёт',
  list_import_logs: 'Журнал импортов',
  get_import_log: 'Запись импорта',
  list_import_connections: 'Подключения импорта',
  list_map3d_custom_models: '3D-модели карты',
  admin_list_jobs: 'Журнал задач (админ)',
  admin_jobs_health: 'Состояние очереди (админ)',
  admin_list_users: 'Пользователи (админ)',
  admin_stats: 'Статистика системы (админ)',
  list_wiki_articles: 'Справка: список статей',
  search_wiki: 'Поиск в справке',
  get_wiki_article: 'Статья справки',
};

export function toolLabel(tool: string): string {
  return TOOL_LABELS_RU[tool] ?? tool;
}

export type QuickCommand = {
  label: string;
  message: string;
  adminOnly?: boolean;
  needsProject?: boolean;
};

export type QuickCommandContext = {
  pathname: string;
  role: string | undefined;
  hasProject: boolean;
};

export const QUICK_COMMANDS: QuickCommand[] = [
  { label: 'Проекты', message: 'Покажи мои проекты' },
  {
    label: 'Активная задача',
    message: 'Есть ли активная фоновая задача в текущем проекте?',
    needsProject: true,
  },
  {
    label: 'Тарифы',
    message: 'Покажи тарифы текущего проекта',
    needsProject: true,
  },
  {
    label: 'POI',
    message: 'Список POI в текущем проекте',
    needsProject: true,
  },
  {
    label: 'Журнал задач',
    message: 'Покажи журнал фоновых задач (админ)',
    adminOnly: true,
  },
  {
    label: 'Роли и доступ',
    message: 'Какие роли есть в Atlas Grid и что им доступно?',
  },
  {
    label: 'Фоновые задачи',
    message: 'Как работают фоновые задачи и где смотреть их статус?',
  },
];

type ContextualChip = {
  match: (ctx: QuickCommandContext) => boolean;
  chip: QuickCommand;
};

const TAB_HELP_CHIPS: { prefix: string; label: string; message: string }[] = [
  { prefix: '/map', label: 'Справка: карта', message: 'Как пользоваться картой 2D и панелью слоёв?' },
  { prefix: '/matrix', label: 'Справка: матрица', message: 'Как работает матрица решений?' },
  { prefix: '/flows/', label: 'Справка: потоки', message: 'Что показывают вкладки раздела Потоки?' },
  { prefix: '/logistics/', label: 'Справка: логистика', message: 'Что настраивается в разделе Логистика?' },
  { prefix: '/import', label: 'Справка: импорт', message: 'Как импортировать данные и проект Искра?' },
  { prefix: '/parameters/', label: 'Справка: параметры', message: 'Что настраивается в разделе Параметры?' },
];

const CONTEXTUAL_CHIPS: ContextualChip[] = [
  ...TAB_HELP_CHIPS.map(({ prefix, label, message }) => ({
    match: ({ pathname }: QuickCommandContext) => {
      const path = stripProjectPrefix(pathname);
      return path === prefix || (prefix.endsWith('/') && path.startsWith(prefix));
    },
    chip: { label, message },
  })),
  {
    match: ({ pathname, hasProject }) =>
      stripProjectPrefix(pathname) === '/map' && hasProject,
    chip: {
      label: 'Объекты на карте',
      message: 'Покажи объекты инфраструктуры на карте текущего проекта',
      needsProject: true,
    },
  },
  {
    match: ({ pathname, hasProject }) =>
      stripProjectPrefix(pathname) === '/matrix' && hasProject,
    chip: {
      label: 'Матрица',
      message: 'Кратко опиши матрицу решений текущего проекта',
      needsProject: true,
    },
  },
  {
    match: ({ pathname, hasProject }) =>
      stripProjectPrefix(pathname).startsWith('/flows/') && hasProject,
    chip: {
      label: 'Схема потоков',
      message: 'Покажи схему потоков для текущего POI',
      needsProject: true,
    },
  },
  {
    match: ({ pathname, role }) => role === 'admin' && pathname.startsWith('/admin'),
    chip: {
      label: 'Статистика',
      message: 'Покажи статистику системы',
      adminOnly: true,
    },
  },
];

function filterQuickCommands(commands: QuickCommand[], ctx: QuickCommandContext): QuickCommand[] {
  return commands.filter((cmd) => {
    if (cmd.adminOnly && ctx.role !== 'admin') return false;
    if (cmd.needsProject && !ctx.hasProject) return false;
    return true;
  });
}

export function getQuickCommands(ctx: QuickCommandContext): QuickCommand[] {
  const contextual = CONTEXTUAL_CHIPS.filter((entry) => entry.match(ctx)).map(
    (entry) => entry.chip,
  );
  const base = QUICK_COMMANDS;
  const seen = new Set<string>();
  const merged: QuickCommand[] = [];

  for (const cmd of [...contextual, ...base]) {
    if (seen.has(cmd.label)) continue;
    seen.add(cmd.label);
    merged.push(cmd);
  }

  return filterQuickCommands(merged, ctx);
}
