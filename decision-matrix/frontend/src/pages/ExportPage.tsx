import { Link } from 'react-router-dom';
import {
  CircleDot,
  Download,
  FileJson,
  FileSpreadsheet,
  Info,
  Layers,
  Map,
  Upload,
} from 'lucide-react';
import { PageSkeleton } from '../components/PageSkeleton';
import { ExportOptionCard } from './export/ExportOptionCard';
import { ExportProjectPanel } from './export/ExportProjectPanel';
import { useExportPage } from './export/useExportPage';

export function ExportPage() {
  const workflow = useExportPage();
  const busy = workflow.projectsLoading || workflow.infraLoading;
  const hasObjects = workflow.infraObjects.length > 0;
  const hasPointObjects = workflow.pointObjects.length > 0;
  const disabled = busy || !workflow.projectId || !hasObjects;
  const pointDisabled = busy || !workflow.projectId || !hasPointObjects;

  if (workflow.projectsLoading) {
    return (
      <div className="export-page">
        <header className="page-header">
          <h1 className="page-title">Экспорт данных</h1>
          <p className="subtitle">Выгрузка координат и GeoJSON инфраструктуры проекта</p>
        </header>
        <PageSkeleton lines={8} />
      </div>
    );
  }

  return (
    <div className="export-page">
      <header className="export-page__header page-header">
        <div>
          <h1 className="page-title">Экспорт данных</h1>
          <p className="subtitle export-page__lead">
            Скачайте координаты объектов и GeoJSON для обмена с другими системами или повторного импорта
          </p>
        </div>
        <div className="export-page__tags" role="list">
          <span className="export-page__tag" role="listitem">
            Excel
          </span>
          <span className="export-page__tag" role="listitem">
            CSV
          </span>
          <span className="export-page__tag export-page__tag--muted" role="listitem">
            GeoJSON
          </span>
        </div>
      </header>

      {!workflow.hasProjects && (
        <div className="export-alert export-alert--info">
          <Info size={18} aria-hidden />
          <span>
            Создайте проект на странице{' '}
            <Link to="/projects" className="export-alert__link">
              «Проекты»
            </Link>
            , затем вернитесь к выгрузке данных.
          </span>
        </div>
      )}

      {workflow.hasProjects && (
        <ExportProjectPanel
          projects={workflow.projects}
          projectId={workflow.projectId}
          onProjectChange={workflow.setProjectId}
        />
      )}

      {workflow.isError && (
        <div className="export-alert export-alert--error">
          <Info size={18} aria-hidden />
          <span>
            Не удалось загрузить объекты проекта:{' '}
            {workflow.error instanceof Error ? workflow.error.message : 'ошибка запроса'}
          </span>
        </div>
      )}

      {workflow.projectId && !busy && !hasObjects && (
        <div className="export-empty card">
          <Map size={28} aria-hidden className="export-empty__icon" />
          <h2 className="export-empty__title">В проекте пока нет объектов</h2>
          <p className="export-empty__hint">
            Добавьте инфраструктуру на карте или импортируйте данные — после этого здесь появятся кнопки
            выгрузки.
          </p>
          <div className="export-empty__actions">
            <Link to="/map" className="btn btn-primary text-sm">
              <Map size={16} aria-hidden />
              Открыть карту
            </Link>
            <Link to="/import" className="btn btn-secondary text-sm">
              <Upload size={16} aria-hidden />
              Импорт данных
            </Link>
          </div>
        </div>
      )}

      {workflow.hasProjects && (
        <div className="export-grid">
          <ExportOptionCard
            icon={<CircleDot size={22} />}
            accent="blue"
            title="Координаты точечных объектов"
            description="Узлы, ГКС, подстанции и другие point-подтипы инфраструктуры."
            countLabel={busy ? 'Загрузка…' : `${workflow.pointObjects.length} объектов`}
            emptyHint="В проекте нет точечных объектов инфраструктуры."
            formats={['xlsx', 'csv']}
            disabled={pointDisabled}
          >
            <button
              type="button"
              className="btn btn-primary text-sm export-option__btn"
              disabled={pointDisabled}
              onClick={workflow.exportPointsExcel}
            >
              <FileSpreadsheet size={16} aria-hidden />
              Excel
            </button>
            <button
              type="button"
              className="btn btn-secondary text-sm export-option__btn"
              disabled={pointDisabled}
              onClick={workflow.exportPointsCsv}
            >
              <Download size={16} aria-hidden />
              CSV
            </button>
          </ExportOptionCard>

          <ExportOptionCard
            icon={<FileJson size={22} />}
            accent="green"
            title="GeoJSON проекта"
            description="FeatureCollection в формате, совместимом с импортом GeoJSON на странице «Импорт»."
            countLabel={busy ? 'Загрузка…' : `${workflow.infraObjects.length} объектов`}
            emptyHint="Нет объектов для формирования GeoJSON."
            formats={['geojson']}
            disabled={disabled}
          >
            <button
              type="button"
              className="btn btn-primary text-sm export-option__btn export-option__btn--wide"
              disabled={disabled}
              onClick={workflow.exportGeoJson}
            >
              <Download size={16} aria-hidden />
              Скачать .geojson
            </button>
          </ExportOptionCard>

          <ExportOptionCard
            icon={<Layers size={22} />}
            accent="violet"
            title="Координаты всех объектов"
            description="Точечные и линейные объекты: начало, конец и полный путь линий."
            countLabel={
              busy
                ? 'Загрузка…'
                : `${workflow.pointObjects.length} точек · ${workflow.lineCount} линий`
            }
            emptyHint="Нет объектов для выгрузки координат."
            formats={['xlsx', 'csv']}
            disabled={disabled}
          >
            <button
              type="button"
              className="btn btn-primary text-sm export-option__btn"
              disabled={disabled}
              onClick={workflow.exportAllExcel}
            >
              <FileSpreadsheet size={16} aria-hidden />
              Excel
            </button>
            <button
              type="button"
              className="btn btn-secondary text-sm export-option__btn"
              disabled={disabled}
              onClick={workflow.exportAllCsv}
            >
              <Download size={16} aria-hidden />
              CSV
            </button>
          </ExportOptionCard>
        </div>
      )}
    </div>
  );
}
