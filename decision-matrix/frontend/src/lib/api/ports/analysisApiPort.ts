import { analysisApi } from '../analysisApi';

/** POI environment analysis read/override on the map. */
export type MapAnalysisApiPort = Pick<
  typeof analysisApi,
  'getPoiAnalysis' | 'analyzePoi' | 'overrideAnalysis' | 'getCandidates'
>;

export const defaultMapAnalysisApi: MapAnalysisApiPort = analysisApi;

/** Batch analyze-all POST (may return 202 job envelope). */
export type AnalysisBatchApiPort = Pick<typeof analysisApi, 'analyzeAllPois'>;

export const defaultAnalysisBatchApi: AnalysisBatchApiPort = analysisApi;
