import { Zap } from 'lucide-react';

export type MapPageHeaderProps = {
  projectId: string | null;
  poisCount: number;
  canWriteProject: boolean;
  analyzePending: boolean;
  onAnalyze: () => void;
};

export function MapPageHeader({
  projectId,
  poisCount,
  canWriteProject,
  analyzePending,
  onAnalyze,
}: MapPageHeaderProps) {
  return (
    <header className="page-header map-page-header shrink-0">
      <h1>Карта инфраструктуры</h1>
      {projectId && poisCount > 0 && canWriteProject && (
        <button
          type="button"
          className="btn btn-primary shrink-0"
          onClick={onAnalyze}
          disabled={analyzePending}
          title={
            poisCount > 1
              ? `Пересчитать анализ для всех ${poisCount} точек интереса`
              : 'Пересчитать анализ окружения'
          }
        >
          <Zap size={16} className="inline mr-1" />
          {analyzePending
            ? 'Расчёт…'
            : poisCount > 1
              ? (
                <>
                  <span className="map-analyze-label">Анализировать все точки ({poisCount})</span>
                  <span className="map-analyze-label-short">Анализ ({poisCount})</span>
                </>
              )
              : (
                <>
                  <span className="map-analyze-label">Анализировать окружение</span>
                  <span className="map-analyze-label-short">Анализ</span>
                </>
              )}
        </button>
      )}
    </header>
  );
}
