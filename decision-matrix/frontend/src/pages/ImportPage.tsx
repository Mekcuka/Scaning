import { Link } from 'react-router-dom';
import { Info, Link as LinkIcon, Route, Upload } from 'lucide-react';
import { PageSkeleton } from '../components/PageSkeleton';
import { usePageHeader } from '../components/layout/pageHeaderContext';
import { useActiveProject } from '../hooks/useActiveProject';
import { ExportOptionCard } from './export/ExportOptionCard';
import { ImportConnectionsSection } from './import/ImportConnectionsSection';
import { ImportFilesSection } from './import/ImportFilesSection';
import { ImportHistorySection } from './import/ImportHistorySection';
import { ImportProjectPanel } from './import/ImportProjectPanel';
import { IMPORT_WELL_SURVEY_CSV_TEMPLATE } from './import/importWellSurveyCsvTemplate';
import { ImportWellSurveysSection } from './import/ImportWellSurveysSection';
import { useImportPageWorkflow } from './import/useImportPageWorkflow';
import { useImportWellSurveysWorkflow } from './import/useImportWellSurveysWorkflow';

export function ImportPage() {
  const workflow = useImportPageWorkflow();
  const surveyWorkflow = useImportWellSurveysWorkflow();
  const { projects, projectId, setProjectId, hasProjects, isLoading: projectsLoading } =
    useActiveProject();

  const importDisabled = workflow.readOnly || !projectId;
  const filesCountLabel = workflow.isLoading
    ? 'Загрузка…'
    : workflow.preview
      ? `Превью: ${workflow.preview.records_total} строк`
      : `${workflow.history.length} ${workflow.history.length === 1 ? 'операция' : 'операций'} в журнале`;

  usePageHeader(
    {
      title: 'Импорт данных',
      subtitle: workflow.readOnly ? 'Импорт недоступен в режиме просмотра' : null,
    },
    [workflow.readOnly],
  );

  if (projectsLoading) {
    return (
      <div className="import-page export-page">
        <PageSkeleton lines={8} />
      </div>
    );
  }

  return (
    <div className="import-page export-page">
      <div className="export-page__tags mb-4" role="list">
        <span className="export-page__tag" role="listitem">
          CSV
        </span>
        <span className="export-page__tag" role="listitem">
          GeoJSON
        </span>
        <span className="export-page__tag" role="listitem">
          KML
        </span>
        <span className="export-page__tag export-page__tag--muted" role="listitem">
          Shapefile
        </span>
      </div>

      {!hasProjects && (
        <div className="export-alert export-alert--info">
          <Info size={18} aria-hidden />
          <span>
            Создайте проект на странице{' '}
            <Link to="/projects" className="export-alert__link">
              «Проекты»
            </Link>
            , затем загрузите данные.
          </span>
        </div>
      )}

      {workflow.readOnly && (
        <div className="export-alert export-alert--info">
          <Info size={18} aria-hidden />
          <span>Импорт недоступен в режиме просмотра.</span>
        </div>
      )}

      {hasProjects && (
        <ImportProjectPanel
          projects={projects}
          projectId={projectId}
          onProjectChange={setProjectId}
        />
      )}

      {workflow.pendingLogId && (
        <div className="export-alert export-alert--info">
          <Info size={18} aria-hidden />
          <div className="import-pending">
            <p className="import-pending__label">
              Импорт в фоне: {workflow.pendingLog?.status || 'pending'}…
            </p>
            <div className="import-pending__bar">
              <div
                className="import-pending__fill"
                style={{
                  width:
                    workflow.pendingLog?.status === 'completed'
                      ? '100%'
                      : workflow.pendingLog?.status === 'running'
                        ? '60%'
                        : '20%',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {hasProjects && (
        <div className="export-grid">
          <ExportOptionCard
            icon={<Upload size={22} />}
            accent="blue"
            title="Импорт файлов"
            description="Точечная и линейная инфраструктура из CSV, GeoJSON, KML и Shapefile."
            countLabel={filesCountLabel}
            emptyHint={
              workflow.readOnly
                ? 'Импорт недоступен в режиме просмотра'
                : 'Выберите проект для загрузки файлов'
            }
            formatTags={['CSV', 'GeoJSON', 'KML', 'ZIP']}
            disabled={importDisabled}
            body={
              <ImportFilesSection
                embedded
                fileInputRef={workflow.fileInputRef}
                readOnly={workflow.readOnly}
                busy={workflow.busy}
                useAsync={workflow.useAsync}
                setUseAsync={workflow.setUseAsync}
                preview={workflow.preview}
                previewRejected={workflow.previewRejected}
                onFile={workflow.onFile}
              />
            }
          >
            <button
              type="button"
              className="btn btn-secondary text-sm export-option__btn"
              disabled={workflow.busy || workflow.readOnly}
              onClick={() => {
                const f = workflow.fileInputRef.current?.files?.[0];
                if (f) void workflow.onFile(f, false);
              }}
            >
              Превью (dry-run)
            </button>
            <button
              type="button"
              className="btn btn-secondary text-sm export-option__btn"
              disabled={workflow.readOnly}
              onClick={() => {
                const input = workflow.fileInputRef.current;
                input?.click();
              }}
            >
              Выбрать файл
            </button>
          </ExportOptionCard>

          <ExportOptionCard
            icon={<LinkIcon size={22} />}
            accent="green"
            title="Подключение API"
            description="REST-источник инфраструктуры с тестом и синхронизацией в проект."
            countLabel={`${workflow.connections.length} ${
              workflow.connections.length === 1 ? 'подключение' : 'подключений'
            }`}
            emptyHint={
              workflow.readOnly
                ? 'Импорт недоступен в режиме просмотра'
                : 'Выберите проект для настройки API'
            }
            formatTags={['REST', 'Bearer', 'API Key']}
            disabled={importDisabled}
            body={
              <ImportConnectionsSection
                embedded
                projectId={workflow.projectId}
                readOnly={workflow.readOnly}
                connForm={workflow.connForm}
                setConnForm={workflow.setConnForm}
                connections={workflow.connections}
                selectedConnId={workflow.selectedConnId}
                setSelectedConnId={workflow.setSelectedConnId}
                saveConnMut={workflow.saveConnMut}
                testConnMut={workflow.testConnMut}
                syncConnMut={workflow.syncConnMut}
              />
            }
          >
            <button
              type="button"
              className="btn btn-primary text-sm export-option__btn"
              disabled={!projectId || workflow.readOnly}
              onClick={() => workflow.saveConnMut.mutate()}
            >
              Сохранить
            </button>
            <button
              type="button"
              className="btn btn-secondary text-sm export-option__btn"
              disabled={!projectId || !workflow.selectedConnId || workflow.readOnly}
              onClick={() =>
                workflow.selectedConnId && workflow.testConnMut.mutate(workflow.selectedConnId)
              }
            >
              Тест
            </button>
            <button
              type="button"
              className="btn btn-secondary text-sm export-option__btn export-option__btn--wide"
              disabled={!projectId || !workflow.selectedConnId || workflow.readOnly}
              onClick={() =>
                workflow.selectedConnId && workflow.syncConnMut.mutate(workflow.selectedConnId)
              }
            >
              Синхронизировать
            </button>
          </ExportOptionCard>

          <ExportOptionCard
            icon={<Route size={22} />}
            accent="violet"
            title="Импорт инклинометрии"
            description="Траектории скважин на куст из CSV или .wbp с preview и фоновым режимом."
            countLabel={`${surveyWorkflow.padOptions.length} ${
              surveyWorkflow.padOptions.length === 1 ? 'куст' : 'кустов'
            }`}
            emptyHint={
              surveyWorkflow.readOnly
                ? 'Импорт недоступен в режиме просмотра'
                : 'Выберите проект и куст для загрузки траекторий'
            }
            formatTags={['CSV', 'WBP']}
            disabled={surveyWorkflow.readOnly || !projectId}
            body={
              <ImportWellSurveysSection
                embedded
                readOnly={surveyWorkflow.readOnly}
                hasProjects={surveyWorkflow.hasProjects}
                padOptions={surveyWorkflow.padOptions}
                padId={surveyWorkflow.padId}
                setPadId={surveyWorkflow.setPadId}
                fileInputRef={surveyWorkflow.fileInputRef}
                preview={surveyWorkflow.preview}
                format={surveyWorkflow.format}
                useAsync={surveyWorkflow.useAsync}
                setUseAsync={surveyWorkflow.setUseAsync}
                interpolate={surveyWorkflow.interpolate}
                setInterpolate={surveyWorkflow.setInterpolate}
                busy={surveyWorkflow.busy}
                asyncThreshold={surveyWorkflow.asyncThreshold}
                onFile={surveyWorkflow.onFile}
                onCommit={surveyWorkflow.onCommit}
              />
            }
          >
            <button
              type="button"
              className="btn btn-secondary text-sm export-option__btn"
              disabled={surveyWorkflow.readOnly}
              onClick={() => {
                const blob = new Blob([IMPORT_WELL_SURVEY_CSV_TEMPLATE], {
                  type: 'text/csv;charset=utf-8',
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'well_survey_template.csv';
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Шаблон CSV
            </button>
            {surveyWorkflow.preview ? (
              <button
                type="button"
                className="btn btn-primary text-sm export-option__btn export-option__btn--wide"
                disabled={
                  surveyWorkflow.readOnly ||
                  surveyWorkflow.busy ||
                  surveyWorkflow.preview.wells.length === 0
                }
                onClick={() => void surveyWorkflow.onCommit()}
              >
                Импортировать на куст
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary text-sm export-option__btn"
                disabled={surveyWorkflow.readOnly || !surveyWorkflow.padId || surveyWorkflow.busy}
                onClick={() => surveyWorkflow.fileInputRef.current?.click()}
              >
                Выбрать файл
              </button>
            )}
          </ExportOptionCard>
        </div>
      )}

      {projectId && (
        <ImportHistorySection history={workflow.history} isLoading={workflow.isLoading} />
      )}
    </div>
  );
}
