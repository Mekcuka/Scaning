import { ImportConnectionsSection } from './import/ImportConnectionsSection';
import { ImportFilesSection } from './import/ImportFilesSection';
import { ImportHistorySection } from './import/ImportHistorySection';
import { ImportWellSurveysSection } from './import/ImportWellSurveysSection';
import { useImportPageWorkflow } from './import/useImportPageWorkflow';
import { useImportWellSurveysWorkflow } from './import/useImportWellSurveysWorkflow';

export function ImportPage() {
  const workflow = useImportPageWorkflow();
  const surveyWorkflow = useImportWellSurveysWorkflow();

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Импорт данных</h1>
        {workflow.readOnly && (
          <p className="subtitle" style={{ color: 'var(--text-muted)' }}>
            Импорт недоступен в режиме просмотра
          </p>
        )}
      </header>

      {!workflow.projectsLoading && !workflow.hasProjects && (
        <div className="card mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          Создайте проект на странице «Проекты», затем загрузите CSV.
        </div>
      )}

      {workflow.pendingLogId && (
        <div className="card mb-4">
          <p className="text-sm mb-2">Импорт в фоне: {workflow.pendingLog?.status || 'pending'}…</p>
          <div className="h-2 bg-gray-200 rounded overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
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
      )}

      <ImportWellSurveysSection
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ImportConnectionsSection
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
        <ImportFilesSection
          fileInputRef={workflow.fileInputRef}
          readOnly={workflow.readOnly}
          busy={workflow.busy}
          useAsync={workflow.useAsync}
          setUseAsync={workflow.setUseAsync}
          preview={workflow.preview}
          previewRejected={workflow.previewRejected}
          onFile={workflow.onFile}
        />
      </div>

      <ImportHistorySection history={workflow.history} isLoading={workflow.isLoading} />
    </div>
  );
}
