import { useMemo } from 'react';

import { WellTrajectoryProfileChart } from '../../components/padClustering/WellTrajectoryProfileChart';
import { PageSkeleton } from '../../components/PageSkeleton';
import {
  TableExcelExportBodyCell,
  TableExcelExportButton,
} from '../../components/TableExcelExportButton';
import { usePadClusteringEditorContext } from '../../contexts/PadClusteringEditorContext';
import { usePadClusteringProfileSubject } from '../../contexts/PadClusteringProfileSubjectContext';
import {
  trajectoryProfileExportFilename,
  trajectoryProfileTableExportColumns,
} from '../../lib/tableExcelExportData';
import { resolveGsProfileMarkers } from '../../lib/wellTrajectoryProfile';
import './pad-clustering-page.css';

function formatCell(value: number | undefined | null, digits = 2): string {
  if (value == null || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('ru-RU', { maximumFractionDigits: digits });
}

export function PadClusteringProfilePage() {
  const { activePadId, isLoading, trajectories, pad, linkedBottomholes } =
    usePadClusteringEditorContext();
  const { allSubjects, selectedSubject, profilePoints } = usePadClusteringProfileSubject();

  const gsMarkers = useMemo(() => {
    if (!selectedSubject || profilePoints.length < 2) return [];
    return resolveGsProfileMarkers(
      profilePoints,
      linkedBottomholes,
      selectedSubject,
      pad?.lon ?? 0,
      pad?.lat ?? 0,
    );
  }, [selectedSubject, profilePoints, linkedBottomholes, pad?.lon, pad?.lat]);

  if (!activePadId) return null;
  if (isLoading && trajectories.length === 0) return <PageSkeleton lines={6} />;

  return (
    <div className="pad-clustering-profile">
      {allSubjects.length === 0 && (
        <p className="pad-clustering-section__hint">
          Нет рассчитанной траектории. Выполните design-from-bottomholes на вкладке «Куст».
        </p>
      )}

      {selectedSubject && profilePoints.length >= 2 && (
        <div className="pad-clustering-profile__panels">
          <section className="pad-clustering-profile__panel pad-clustering-profile__panel--chart">
            <h3 className="pad-clustering-profile__panel-title">Профиль MD–TVD</h3>
            <WellTrajectoryProfileChart points={profilePoints} markers={gsMarkers} />
          </section>
          <section className="pad-clustering-profile__panel pad-clustering-profile__panel--table">
            <h3 className="pad-clustering-profile__panel-title">Станции</h3>
            <div className="pad-clustering-profile__table-wrap">
              <table className="pad-clustering-table text-xs pad-clustering-profile__table">
                <thead>
                  <tr>
                    <th>MD, м</th>
                    <th>TVD, м</th>
                    <th title="Угол наклонения ствола от вертикали">Наклон, °</th>
                    <th title="Направление ствола в горизонтальной плоскости">Азимут, °</th>
                    <th title="Интенсивность искривления на интервале до этой станции (градусы на 30 м)">
                      DLS, °/30&nbsp;м
                    </th>
                    <th title="Смещение от устья в сторону севера">На север, м</th>
                    <th title="Смещение от устья в сторону востока">На восток, м</th>
                    <th className="table-excel-export-th">
                      <TableExcelExportButton
                        filename={trajectoryProfileExportFilename(
                          pad?.name ?? 'kust',
                          selectedSubject.label,
                        )}
                        sheetName={selectedSubject.label}
                        columns={trajectoryProfileTableExportColumns()}
                        rows={profilePoints}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {profilePoints.map((pt, idx) => (
                    <tr key={idx}>
                      <td>{formatCell(pt.md, 1)}</td>
                      <td>{formatCell(pt.tvd, 1)}</td>
                      <td>{formatCell(pt.inc, 2)}</td>
                      <td>{formatCell(pt.azi, 2)}</td>
                      <td>{formatCell(pt.dls, 2)}</td>
                      <td>{formatCell(pt.n, 2)}</td>
                      <td>{formatCell(pt.e, 2)}</td>
                      <TableExcelExportBodyCell />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {selectedSubject && profilePoints.length < 2 && allSubjects.length > 0 && (
        <p className="pad-clustering-section__hint">
          {selectedSubject.kind === 'lateral'
            ? 'Выберите доп.ствол с построенной веткой PyWellGeo.'
            : 'Недостаточно станций для профиля.'}
        </p>
      )}
    </div>
  );
}
