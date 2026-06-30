import { Zap } from 'lucide-react';
import { Button } from 'antd';

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
        <Button
          type="primary"
          className="map-analyze-split__segment map-analyze-split__segment--left shrink-0"
          icon={<Zap size={16} className="map-analyze-split__icon" aria-hidden />}
          loading={analyzePending}
          onClick={onAnalyzeAll}
          title={`Пересчитать анализ для всех ${poisCount} точек интереса`}
        >
          <span className="map-analyze-label">
            {analyzePending ? 'Расчёт…' : `Все точки (${poisCount})`}
          </span>
          <span className="map-analyze-label-short">
            {analyzePending ? '…' : `Все (${poisCount})`}
          </span>
        </Button>
        <Button
          type="primary"
          className="map-analyze-split__segment map-analyze-split__segment--right shrink-0"
          loading={analyzePending}
          disabled={!selectedPoiId}
          onClick={onAnalyzeSelected}
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
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="primary"
      className="shrink-0"
      icon={<Zap size={16} aria-hidden />}
      loading={analyzePending}
      onClick={onAnalyzeAll}
      title="Пересчитать анализ окружения"
    >
      <span className="map-analyze-label">
        {analyzePending ? 'Расчёт…' : 'Анализировать окружение'}
      </span>
      <span className="map-analyze-label-short">{analyzePending ? '…' : 'Анализ'}</span>
    </Button>
  );
}

/** @deprecated Use MapPageAnalyzeActions with usePageHeader in MapPage */
export type MapPageHeaderProps = MapPageAnalyzeActionsProps;

/** @deprecated Use MapPageAnalyzeActions with usePageHeader in MapPage */
export function MapPageHeader(props: MapPageHeaderProps) {
  return <MapPageAnalyzeActions {...props} />;
}
