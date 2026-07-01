import { useMemo } from 'react';
import type { ColumnsType } from 'antd/es/table';

import { WellTrajectoryProfileChart } from '../../components/padClustering/WellTrajectoryProfileChart';
import { PageSkeleton } from '../../components/PageSkeleton';
import { AppDataTable } from '../../components/AppDataTable';
import { usePadClusteringEditorContext } from '../../contexts/PadClusteringEditorContext';
import { usePadClusteringProfileSubject } from '../../contexts/PadClusteringProfileSubjectContext';
import {
  trajectoryProfileExportFilename,
  trajectoryProfileTableExportColumns,
} from '../../lib/tableExcelExportData';
import type { TrajectoryProfilePoint } from '../../lib/wellTrajectoryProfile';
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

  const columns = useMemo<ColumnsType<TrajectoryProfilePoint>>(
    () => [
      {
        title: 'MD, м',
        key: 'md',
        render: (_, pt) => formatCell(pt.md, 1),
      },
      {
        title: 'TVD, м',
        key: 'tvd',
        render: (_, pt) => formatCell(pt.tvd, 1),
      },
      {
        title: 'Наклон, °',
        key: 'inc',
        render: (_, pt) => formatCell(pt.inc, 2),
        onHeaderCell: () => ({ title: 'Угол наклонения ствола от вертикали' }),
      },
      {
        title: 'Азимут, °',
        key: 'azi',
        render: (_, pt) => formatCell(pt.azi, 2),
        onHeaderCell: () => ({ title: 'Направление ствола в горизонтальной плоскости' }),
      },
      {
        title: 'DLS, °/30 м',
        key: 'dls',
        render: (_, pt) => formatCell(pt.dls, 2),
        onHeaderCell: () => ({
          title: 'Интенсивность искривления на интервале до этой станции (градусы на 30 м)',
        }),
      },
      {
        title: 'На север, м',
        key: 'n',
        render: (_, pt) => formatCell(pt.n, 2),
        onHeaderCell: () => ({ title: 'Смещение от устья в сторону севера' }),
      },
      {
        title: 'На восток, м',
        key: 'e',
        render: (_, pt) => formatCell(pt.e, 2),
        onHeaderCell: () => ({ title: 'Смещение от устья в сторону востока' }),
      },
    ],
    [],
  );

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
              <AppDataTable
                className="pad-clustering-table text-xs pad-clustering-profile__table"
                rowKey={(_, index) => String(index ?? 0)}
                columns={columns}
                dataSource={profilePoints}
                excelExport={
                  selectedSubject
                    ? {
                        filename: trajectoryProfileExportFilename(
                          pad?.name ?? 'kust',
                          selectedSubject.label,
                        ),
                        sheetName: selectedSubject.label,
                        columns: trajectoryProfileTableExportColumns(),
                        rows: profilePoints,
                      }
                    : undefined
                }
              />
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
