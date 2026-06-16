import { stripProjectPrefix } from './projectRoutes';

export type PageHeaderConfig = {
  title: string;
  subtitle?: string | null;
};

export function resolvePageHeader(pathname: string): PageHeaderConfig | null {
  const path = stripProjectPrefix(pathname);
  if (path === '/' || path === '') {
    return {
      title: 'Дашборд',
      subtitle: 'Оценка инфраструктуры и сравнение точек интереса',
    };
  }
  if (path === '/projects') {
    return {
      title: 'Проекты',
      subtitle: 'Управление участками и точками интереса',
    };
  }
  if (path.startsWith('/projects/')) {
    return null;
  }
  if (path === '/map') {
    return { title: 'Карта инфраструктуры' };
  }
  if (path.startsWith('/pad-clustering')) {
    return { title: 'Кустование' };
  }
  if (path.startsWith('/parameters')) {
    return {
      title: 'Параметры',
      subtitle:
        'Пропускная способность, земляные работы, точки подключения, объёмы песка, даты ввода и ставки по POI',
    };
  }
  if (path === '/import' || path === '/data/import') {
    return { title: 'Импорт данных' };
  }
  if (path === '/export' || path === '/data/export') {
    return {
      title: 'Экспорт данных',
      subtitle: 'Выгрузка координат и GeoJSON инфраструктуры проекта',
    };
  }
  if (path === '/import-3d' || path === '/data/import-3d') {
    return {
      title: 'Импорт 3D',
      subtitle: 'Пользовательские GLB-модели для точечных объектов на карте в режиме 3D.',
    };
  }
  if (path.startsWith('/data')) {
    return {
      title: 'Данные',
      subtitle: 'Импорт, экспорт и пользовательские 3D-модели проекта',
    };
  }
  if (path === '/matrix') {
    return {
      title: 'Матрица решений',
      subtitle: 'Сравнение анализа окружения по всем точкам интереса проекта',
    };
  }
  if (path === '/report') {
    return {
      title: 'Отчёты',
      subtitle: 'Одностраничники для руководства',
    };
  }
  if (path === '/report/new') {
    return { title: 'Новый одностраничник' };
  }
  if (path.startsWith('/report/')) {
    return { title: 'Одностраничник' };
  }
  if (path.startsWith('/flows')) {
    return {
      title: 'Схема потоков',
      subtitle:
        'Технологический и экономический потоки — по точке интереса; логистика песка — по проекту',
    };
  }
  if (path.startsWith('/admin')) {
    return {
      title: 'Администрирование',
      subtitle: 'Пользователи, роли, фоновые задачи и параметры AI-помощника',
    };
  }
  return null;
}
