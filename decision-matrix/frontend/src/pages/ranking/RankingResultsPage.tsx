import { useState } from 'react';
import { useRankingContext } from './rankingContext';
import { RankingEmptyState } from '../../components/ranking/RankingEmptyState';
import { RankingResultsTable } from '../../components/ranking/RankingResultsTable';
import { RankingBarChart } from '../../components/ranking/RankingBarChart';
import { RankingRadarChart } from '../../components/ranking/RankingRadarChart';
import { RankingPoiCompareMap } from '../../components/ranking/RankingPoiCompareMap';
import { isPoiRanking } from '../../lib/rankingUtils';

export function RankingResultsPage() {
  const { projectId, pois, activePoiId, result, calculating } = useRankingContext();

  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  if (!projectId) return <RankingEmptyState kind="no-project" />;
  if (pois.length === 0) return <RankingEmptyState kind="no-poi" />;

  const alternatives = result?.alternatives ?? [];
  const matrixData = result?.matrix ?? null;
  const poiRanking = isPoiRanking(result);
  const mapPoiId =
    selectedPoiId ??
    String(alternatives.find((a) => a.rank === 1)?.poi_id ?? alternatives[0]?.poi_id ?? activePoiId);

  return (
    <div className="ranking-results">
      <h2 className="ranking-tab-title">Результаты ранжирования</h2>
      <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
        Сравнение <strong>точек интереса</strong> проекта по базовому сценарию каждой POI. Веса и
        алгоритм берутся из настроек выбранной в шапке POI. Для настройки сценариев внутри одной
        точки используйте вкладку «Критерии».
      </p>

      {!result && !calculating && (
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          Нажмите «Рассчитать» в шапке раздела.
        </p>
      )}

      {alternatives.length === 0 && !calculating && <RankingEmptyState kind="no-scenarios" />}

      {alternatives.length > 0 && (
        <>
          <div className="ranking-grid mb-4">
            <div className="card">
              <h2 className="font-semibold mb-3">Рейтинг точек интереса</h2>
              <RankingResultsTable
                alternatives={alternatives}
                selectedIds={compareIds}
                onToggleSelect={toggleCompare}
                onRowClick={(id) => setSelectedPoiId(id)}
                highlightId={mapPoiId}
                unit={poiRanking ? 'poi' : 'scenario'}
              />
              {compareIds.length > 0 && (
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                  Выбрано для сравнения: {compareIds.length}/2
                </p>
              )}
            </div>
            <div className="card">
              <h2 className="font-semibold mb-3">
                {result?.algorithm?.toUpperCase() ?? 'TOPSIS'} score
              </h2>
              <RankingBarChart alternatives={alternatives} />
            </div>
          </div>

          {matrixData && (
            <div className="card mb-4">
              <h2 className="font-semibold mb-3">Профили критериев (radar)</h2>
              <RankingRadarChart
                matrix={matrixData}
                alternatives={alternatives}
                selectedScenarioIds={compareIds}
              />
            </div>
          )}

          {projectId && (
            <div className="card">
              <h2 className="font-semibold mb-3">Точки на карте</h2>
              <RankingPoiCompareMap
                projectId={projectId}
                pois={pois}
                alternatives={alternatives}
                selectedPoiId={mapPoiId}
                onSelectPoi={setSelectedPoiId}
              />
            </div>
          )}

          {result?.skipped_pois && result.skipped_pois.length > 0 && (
            <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>
              Не участвовали (нет анализа): {result.skipped_pois.join(', ')}. Запустите анализ на
              вкладке «Критерии».
            </p>
          )}
        </>
      )}
    </div>
  );
}
