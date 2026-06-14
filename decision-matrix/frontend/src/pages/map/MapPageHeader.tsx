import { Zap } from 'lucide-react';

export type MapPageAnalyzeActionsProps = {
  projectId: string | null;
  poisCount: number;
  selectedPoiId: string | null;
  selectedPoiName: string | null;
  canWriteProject: boolean;
  analyzePending: boolean;
  onAnalyzeAll: () => void;
  onAnalyzeSelected: () => void;
};

export function MapPageAnalyzeActions({
  projectId,
  poisCount,
  selectedPoiId,
  selectedPoiName,
  canWriteProject,
  analyzePending,
  onAnalyzeAll,
  onAnalyzeSelected,
}: MapPageAnalyzeActionsProps) {
  if (!projectId || poisCount <= 0 || !canWriteProject) return null;

  const showSplit = poisCount > 1;

  if (showSplit) {
    return (
      <div className="map-analyze-split" role="group" aria-label="Анализ окружения">
        <button
          type="button"
          className="btn btn-primary map-analyze-split__segment map-analyze-split__segment--left shrink-0"
          onClick={onAnalyzeAll}
          disabled={analyzePending}
          title={`Пересчитать анализ для всех ${poisCount} точек интереса`}
        >
          <Zap size={16} className="map-analyze-split__icon" aria-hidden />
          <span className="map-analyze-label">
            {analyzePending ? 'Расчёт…' : `Все точки (${poisCount})`}
          </span>
          <span className="map-analyze-label-short">
            {analyzePending ? '…' : `Все (${poisCount})`}
          </span>
        </button>
        <button
          type="button"
          className="btn btn-primary map-analyze-split__segment map-analyze-split__segment--right shrink-0"
          onClick={onAnalyzeSelected}
          disabled={!selectedPoiId || analyzePending}
          title={
            selectedPoiName
              ? `Анализ только для «${selectedPoiName}»`
              : 'Выберите точку интереса на карте'
          }
        >
          <span className="map-analyze-label">
            {analyzePending ? 'Расчёт…' : 'Выбранная точка'}
          </span>
          <span className="map-analyze-label-short">
            {analyzePending ? '…' : 'Выбранная'}
          </span>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="btn btn-primary shrink-0"
      onClick={onAnalyzeAll}
      disabled={analyzePending}
      title="Пересчитать анализ окружения"
    >
      <Zap size={16} className="inline mr-1" aria-hidden />
      <span className="map-analyze-label">
        {analyzePending ? 'Расчёт…' : 'Анализировать окружение'}
      </span>
      <span className="map-analyze-label-short">{analyzePending ? '…' : 'Анализ'}</span>
    </button>
  );
}

/** @deprecated Use MapPageAnalyzeActions with usePageHeader in MapPage */
export type MapPageHeaderProps = MapPageAnalyzeActionsProps;

/** @deprecated Use MapPageAnalyzeActions with usePageHeader in MapPage */
export function MapPageHeader(props: MapPageHeaderProps) {
  return <MapPageAnalyzeActions {...props} />;
}
