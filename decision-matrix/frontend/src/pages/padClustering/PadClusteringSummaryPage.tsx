import { useMemo } from 'react';

import { PageSkeleton } from '../../components/PageSkeleton';
import { PadClusteringSummaryTable } from '../../components/padClustering/PadClusteringSummaryTable';
import { usePadClusteringEditorContext } from '../../contexts/PadClusteringEditorContext';
import { usePadClusteringProjectSummary } from '../../hooks/usePadClusteringProjectSummary';
import './pad-clustering-page.css';

const EMPTY_PADS_HINT = 'В проекте нет кустов со скважинами (забои, устья или траектории).';
const EMPTY_BOTTOMHOLES_HINT =
  'Привяжите забои на карте или синхронизируйте с вкладки «Куст».';

export function PadClusteringSummaryPage() {
  const { projectId, pads, infraLoading, infraObjects } = usePadClusteringEditorContext();

  const { padTable, bottomholeTable, padsWithWellsCount, isLoading } = usePadClusteringProjectSummary(
    projectId,
    pads,
    infraObjects,
  );

  const padRowHeaderLabel = useMemo(
    () => (padTable.rows.length > 1 ? 'Куст' : 'Раздел'),
    [padTable.rows.length],
  );

  if (infraLoading && pads.length === 0) return <PageSkeleton lines={8} />;
  if (isLoading && padsWithWellsCount === 0 && pads.length > 0) return <PageSkeleton lines={8} />;

  return (
    <div className="pad-clustering-summary">
      <PadClusteringSummaryTable
        title="Кусты"
        table={padTable}
        rowHeaderLabel={padRowHeaderLabel}
        emptyHint={EMPTY_PADS_HINT}
      />
      <PadClusteringSummaryTable
        title="Забои и доп. стволы"
        table={bottomholeTable}
        rowHeaderLabel="Объект"
        emptyHint={EMPTY_BOTTOMHOLES_HINT}
      />
    </div>
  );
}
