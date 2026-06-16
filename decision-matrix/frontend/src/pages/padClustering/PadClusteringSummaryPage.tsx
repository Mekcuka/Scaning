import { useMemo } from 'react';

import { PageSkeleton } from '../../components/PageSkeleton';
import { PadClusteringSummaryTable } from '../../components/padClustering/PadClusteringSummaryTable';
import { usePadClusteringEditorContext } from '../../contexts/PadClusteringEditorContext';
import {
  buildBottomholeSummaryRows,
  buildBottomholeSummaryTable,
  buildPadSummaryRows,
  buildPadSummaryTable,
} from '../../lib/padClusteringSummaryRows';
import './pad-clustering-page.css';

const EMPTY_BOTTOMHOLES_HINT =
  'Привяжите забои на карте или синхронизируйте с вкладки «Куст».';

export function PadClusteringSummaryPage() {
  const {
    activePadId,
    isLoading,
    pad,
    kbM,
    wellsLocalCount,
    trajectoryComputedAt,
    demSource,
    trajectories,
    linkedBottomholes,
  } = usePadClusteringEditorContext();

  const bottomholeNameById = useMemo(
    () => new Map(linkedBottomholes.map((b) => [b.id, b.name])),
    [linkedBottomholes],
  );

  const padTable = useMemo(
    () =>
      buildPadSummaryTable(
        buildPadSummaryRows({
          pad,
          kbM,
          wellsLocalCount,
          trajectoryComputedAt,
          demSource,
          trajectories,
        }),
      ),
    [pad, kbM, wellsLocalCount, trajectoryComputedAt, demSource, trajectories],
  );

  const bottomholeTable = useMemo(
    () =>
      buildBottomholeSummaryTable(
        buildBottomholeSummaryRows(linkedBottomholes, bottomholeNameById, trajectories),
      ),
    [linkedBottomholes, bottomholeNameById, trajectories],
  );

  if (!activePadId) return null;
  if (isLoading && !pad) return <PageSkeleton lines={8} />;

  return (
    <div className="pad-clustering-summary">
      <PadClusteringSummaryTable
        title="Куст"
        table={padTable}
        rowHeaderLabel="Раздел"
        emptyHint="Нет данных по кусту."
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
