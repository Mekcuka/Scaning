import { Link } from 'react-router-dom';
import { Button, Card } from 'antd';
import { ProjectLink } from '../components/ProjectLink';
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
import { usePageHeader } from '../components/layout/pageHeaderContext';
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

  const exportSubtitle = workflow.projectsLoading
    ? 'Выгрузка координат и GeoJSON инфраструктуры проекта'
    : 'Скачайте координаты объектов и GeoJSON для обмена с другими системами или повторного импорта';

  usePageHeader(
    {
      title: 'Экспорт данных',
      subtitle: exportSubtitle,
    },
    [exportSubtitle],
  );

  if (workflow.projectsLoading) {
    return (
      <div className="export-page">
        <PageSkeleton lines={8} />
      </div>
    );
  }

  return (
    <div className="export-page">
      <div className="export-page__tags mb-4" role="list">
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
        <Card size="small" className="export-empty">
          <Map size={28} aria-hidden className="export-empty__icon" />
          <h2 className="export-empty__title">В проекте пока нет объектов</h2>
          <p className="export-empty__hint">
            Добавьте инфраструктуру на карте или импортируйте данные — после этого здесь появятся кнопки
            выгрузки.
          </p>
          <div className="export-empty__actions">
            <ProjectLink to="/map">
              <Button type="primary" size="small" icon={<Map size={16} aria-hidden />}>
                Открыть карту
              </Button>
            </ProjectLink>
            <ProjectLink to="/data/import">
              <Button size="small" icon={<Upload size={16} aria-hidden />}>
                Импорт данных
              </Button>
            </ProjectLink>
          </div>
        </Card>
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
            <Button
              type="primary"
              size="small"
              disabled={pointDisabled}
              icon={<FileSpreadsheet size={16} aria-hidden />}
              onClick={workflow.exportPointsExcel}
            >
              Excel
            </Button>
            <Button
              size="small"
              disabled={pointDisabled}
              icon={<Download size={16} aria-hidden />}
              onClick={workflow.exportPointsCsv}
            >
              CSV
            </Button>
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
            <Button
              type="primary"
              size="small"
              className="export-option__btn--wide"
              disabled={disabled}
              icon={<Download size={16} aria-hidden />}
              onClick={workflow.exportGeoJson}
            >
              Скачать .geojson
            </Button>
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
            <Button
              type="primary"
              size="small"
              disabled={disabled}
              icon={<FileSpreadsheet size={16} aria-hidden />}
              onClick={workflow.exportAllExcel}
            >
              Excel
            </Button>
            <Button
              size="small"
              disabled={disabled}
              icon={<Download size={16} aria-hidden />}
              onClick={workflow.exportAllCsv}
            >
              CSV
            </Button>
          </ExportOptionCard>
        </div>
      )}
    </div>
  );
}
