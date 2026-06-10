import { importApi } from '../importApi';

/** File import page: uploads, logs, and external connections. */
export type ImportWorkflowApiPort = Pick<
  typeof importApi,
  | 'getImportLogs'
  | 'getImportConnections'
  | 'getImportLog'
  | 'previewImport'
  | 'importCsv'
  | 'importCsvAsync'
  | 'importKml'
  | 'importKmlAsync'
  | 'importGeojson'
  | 'importGeojsonAsync'
  | 'importSpark'
  | 'importSparkAsync'
  | 'importShapefile'
  | 'createImportConnection'
  | 'testImportConnection'
  | 'syncImportConnection'
>;

export const defaultImportWorkflowApi: ImportWorkflowApiPort = importApi;
