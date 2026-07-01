import { useMemo, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { Button, Segmented } from 'antd';
import { LineChart, Table2 } from 'lucide-react';

import { AppDataTable } from '../AppDataTable';
import { LineElevationProfileChart } from './LineElevationProfileChart';
import type { InfraObject } from '../../lib/api';
import {
  buildLineProfileTableRows,
  DEFAULT_LINE_PROFILE_STEP_M,
  formatChainageM,
  formatLineProfileDemSource,
  formatLineProfilePointsCount,
  isSyntheticLineProfileDem,
  lineProfileExportFilename,
  lineProfileTableExportColumns,
  MAX_LINE_PROFILE_STEP_M,
  MIN_LINE_PROFILE_STEP_M,
  parseLineProfileFromObject,
  type LineProfileTableRow,
} from '../../lib/lineElevationProfile';
import { useLineElevationProfileCompute, useLineElevationProfileQuery } from '../../hooks/useLineElevationProfileCompute';
import { FieldLabel, PanelSection, StatChip } from './panelUi';

type ProfileViewMode = 'table' | 'chart';

type InfraDetailProfileTabProps = {
  projectId: string | null;
  infraObject: InfraObject | null;
  readOnly: boolean;
  lineProfileStepM: string;
  setLineProfileStepM: (value: string) => void;
};

function formatCell(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('ru-RU', { maximumFractionDigits: digits });
}

function formatComputedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function InfraDetailProfileTab({
  projectId,
  infraObject,
  readOnly,
  lineProfileStepM,
  setLineProfileStepM,
}: InfraDetailProfileTabProps) {
  const [viewMode, setViewMode] = useState<ProfileViewMode>('table');
  const { compute, computePending } = useLineElevationProfileCompute(projectId ?? undefined);
  const cachedProfile = useMemo(() => parseLineProfileFromObject(infraObject), [infraObject]);
  const { data: fetchedProfile, isLoading } = useLineElevationProfileQuery(
    projectId,
    infraObject?.id ?? null,
    !cachedProfile,
  );
  const profile = cachedProfile ?? fetchedProfile ?? null;

  const rows = useMemo(
    () => (profile ? buildLineProfileTableRows(profile.points) : []),
    [profile],
  );

  const columns = useMemo<ColumnsType<LineProfileTableRow>>(
    () => [
      { title: 'Пикет', dataIndex: 'picket', key: 'picket', width: 80 },
      {
        title: 'Расст., м',
        key: 'chainage_m',
        width: 88,
        render: (_, row) => formatChainageM(row.chainage_m),
      },
      {
        title: 'Отм., м',
        key: 'elevation_m',
        width: 72,
        render: (_, row) => formatCell(row.elevation_m, 2),
      },
      {
        title: 'Уклон, ‰',
        key: 'slope_permille',
        width: 72,
        render: (_, row) => formatCell(row.slope_permille, 1),
      },
    ],
    [],
  );

  const showCompute = !readOnly && Boolean(projectId);
  const demLabel = profile?.dem_source ? formatLineProfileDemSource(profile.dem_source) : null;
  const showSyntheticBanner = Boolean(
    profile?.dem_source && isSyntheticLineProfileDem(profile.dem_source),
  );

  return (
    <div className="object-detail-panel__tab-sections">
      <PanelSection title="Расчёт профиля" card>
        <div className="object-detail-panel__field object-detail-panel__field--compact">
          <FieldLabel unit="м">Шаг сэмплинга</FieldLabel>
          <input
            id="line-profile-step-m"
            type="number"
            className="object-detail-panel__input"
            min={MIN_LINE_PROFILE_STEP_M}
            max={MAX_LINE_PROFILE_STEP_M}
            step={1}
            value={lineProfileStepM}
            disabled={readOnly}
            onChange={(e) => setLineProfileStepM(e.target.value)}
            placeholder={String(DEFAULT_LINE_PROFILE_STEP_M)}
          />
          <p className="object-detail-panel__hint">
            {MIN_LINE_PROFILE_STEP_M}–{MAX_LINE_PROFILE_STEP_M} м. Сохраните объект, чтобы применить шаг.
          </p>
        </div>

        {showCompute && (
          <Button
            type="primary"
            block
            className="odp-line-profile__compute"
            disabled={computePending}
            loading={computePending}
            onClick={() => compute()}
          >
            {computePending ? 'Расчёт…' : 'Рассчитать профиль'}
          </Button>
        )}
      </PanelSection>

      {isLoading && !profile && (
        <p className="object-detail-panel__hint">Загрузка профиля…</p>
      )}

      {!isLoading && !profile && (
        <div className="odp-line-profile__empty" role="status">
          <LineChart size={22} strokeWidth={1.75} aria-hidden className="odp-line-profile__empty-icon" />
          <strong>Профиль не рассчитан</strong>
          <p>Здесь появится таблица отметок по пикетам линии.</p>
        </div>
      )}

      {profile && (
        <PanelSection
          title="Результат"
          card
          headerAction={
            <Segmented
              className="odp-line-profile__mode-toggle"
              value={viewMode}
              onChange={(value) => setViewMode(value as ProfileViewMode)}
              aria-label="Режим отображения профиля"
              options={[
                {
                  label: (
                    <span className="odp-line-profile__mode-label">
                      <Table2 size={13} strokeWidth={1.75} aria-hidden className="odp-line-profile__mode-icon" />
                      Таблица
                    </span>
                  ),
                  value: 'table',
                },
                {
                  label: (
                    <span className="odp-line-profile__mode-label">
                      <LineChart size={13} strokeWidth={1.75} aria-hidden className="odp-line-profile__mode-icon" />
                      График
                    </span>
                  ),
                  value: 'chart',
                },
              ]}
            />
          }
        >
          <div className="odp-line-profile__summary">
            <div className="object-detail-panel__stats odp-line-profile__stats">
              <StatChip>{formatChainageM(profile.total_length_m)} м</StatChip>
              <StatChip>{formatLineProfilePointsCount(profile.points.length)}</StatChip>
            </div>
            <p className="odp-line-profile__meta">
              <time dateTime={profile.computed_at}>{formatComputedAt(profile.computed_at)}</time>
              {demLabel && (
                <>
                  <span className="odp-line-profile__meta-sep" aria-hidden>
                    ·
                  </span>
                  <span>{demLabel}</span>
                </>
              )}
            </p>
          </div>

          {showSyntheticBanner && (
            <p className="odp-line-profile__dem-banner" role="note">
              Синтетический ЦМР — результат только для разработки и отладки.
            </p>
          )}

          <div className="odp-line-profile__view">
            {viewMode === 'table' ? (
              <div className="odp-line-profile__table-wrap">
                <AppDataTable
                  className="odp-line-profile__table text-xs"
                  rowKey={(row) => String(row.chainage_m)}
                  columns={columns}
                  dataSource={rows}
                  scroll={{ x: 'max-content', y: 220 }}
                  excelExport={{
                    filename: lineProfileExportFilename(infraObject?.name ?? 'liniya'),
                    sheetName: 'Профиль',
                    columns: lineProfileTableExportColumns(),
                    rows,
                  }}
                />
              </div>
            ) : (
              <LineElevationProfileChart points={profile.points} />
            )}
          </div>
        </PanelSection>
      )}
    </div>
  );
}
