import { useMemo } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { ProjectLink } from '../../components/ProjectLink';
import { MapPin, Target } from 'lucide-react';
import { Button, Input } from 'antd';
import { AppSelect } from '../AppSelect';
import { AppDataTable } from '../AppDataTable';
import type { InfraObject } from '../../lib/api';
import { SUBTYPE_LABELS } from '../../lib/api';
import {
  BOTTOMHOLE_ROLE_OPTIONS,
  DEFAULT_GS_ENTRY_MODE,
  GS_ENTRY_MODE_OPTIONS,
  readGsEntryMode,
  WELL_BOTTOMHOLE_GS_HEEL_ID,
  WELL_BOTTOMHOLE_GS_ENTRY_MODE,
  WELL_BOTTOMHOLE_TVD_M,
  WELL_BOTTOMHOLE_WELL_INDEX,
  isLateralBottomhole,
  orderBottomholesHierarchical,
  readBottomholeRole,
  readBottomholeTvdM,
  GS_HEEL_LABEL,
} from '../../lib/wellBottomholeProperties';
import type { usePadClusteringEditor } from '../../hooks/usePadClusteringEditor';
import { PadClusteringCollapsibleSection } from './PadClusteringCollapsibleSection';

type Editor = ReturnType<typeof usePadClusteringEditor>;

interface PadClusteringBottomholesSectionProps {
  bottomholes: InfraObject[];
  readOnly: boolean;
  saveBottomholeMut: Editor['saveBottomholeMut'];
}

export function PadClusteringBottomholesSection({
  bottomholes,
  readOnly,
  saveBottomholeMut,
}: PadClusteringBottomholesSectionProps) {
  const orderedBottomholes = useMemo(
    () => orderBottomholesHierarchical(bottomholes),
    [bottomholes],
  );

  const columns = useMemo<ColumnsType<InfraObject>>(
    () => [
      {
        title: 'Забой',
        key: 'name',
        className: 'pad-clustering-bottomholes-table__name',
        render: (_, bottomhole) => {
          const isChild = isLateralBottomhole(bottomhole);
          const gsHeelId = bottomhole.properties?.[WELL_BOTTOMHOLE_GS_HEEL_ID];
          return (
            <>
              <span
                className="pad-clustering-bottomholes-table__name-text"
                style={isChild ? { paddingLeft: '1rem' } : undefined}
              >
                {bottomhole.name}
              </span>
              {bottomhole.subtype === 'well_bottomhole_gs_toe' && typeof gsHeelId === 'string' && (
                <span className="pad-clustering-bottomholes-table__sub" title={gsHeelId}>
                  {GS_HEEL_LABEL} {gsHeelId.slice(0, 8)}…
                </span>
              )}
            </>
          );
        },
      },
      {
        title: 'Роль',
        key: 'role',
        className: 'pad-clustering-bottomholes-table__type',
        render: (_, bottomhole) => {
          const props = bottomhole.properties ?? {};
          return (
            BOTTOMHOLE_ROLE_OPTIONS.find((o) => o.value === readBottomholeRole(props))?.label ??
            'Основной забой'
          );
        },
      },
      {
        title: 'Тип',
        key: 'subtype',
        className: 'pad-clustering-bottomholes-table__type',
        render: (_, bottomhole) => SUBTYPE_LABELS[bottomhole.subtype] ?? bottomhole.subtype,
      },
      {
        title: 'Скв. №',
        key: 'well_index',
        render: (_, bottomhole) => {
          const props = bottomhole.properties ?? {};
          const isChild = isLateralBottomhole(bottomhole);
          const wellIndexRaw = props[WELL_BOTTOMHOLE_WELL_INDEX];
          const wellIndex = wellIndexRaw === '' || wellIndexRaw == null ? '' : String(wellIndexRaw);
          const onSave = (properties: Record<string, unknown>) =>
            saveBottomholeMut.mutate({
              objectId: bottomhole.id,
              properties: { ...props, ...properties },
            });
          return (
            <Input
              className="pad-clustering-bottomholes-table__input"
              type="number"
              min={0}
              max={63}
              disabled={readOnly || saveBottomholeMut.isPending || isChild}
              defaultValue={wellIndex}
              key={`${bottomhole.id}-wi-${String(wellIndexRaw)}`}
              aria-label={`Скв. № для ${bottomhole.name}`}
              onBlur={(e) =>
                onSave({
                  [WELL_BOTTOMHOLE_WELL_INDEX]:
                    e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
            />
          );
        },
      },
      {
        title: 'TVD, м',
        key: 'tvd',
        render: (_, bottomhole) => {
          const props = bottomhole.properties ?? {};
          const tvdM = readBottomholeTvdM(props);
          const onSave = (properties: Record<string, unknown>) =>
            saveBottomholeMut.mutate({
              objectId: bottomhole.id,
              properties: { ...props, ...properties },
            });
          return (
            <Input
              className="pad-clustering-bottomholes-table__input"
              type="number"
              min={1}
              disabled={readOnly || saveBottomholeMut.isPending}
              defaultValue={tvdM}
              key={`${bottomhole.id}-tvd-${tvdM}`}
              aria-label={`TVD для ${bottomhole.name}`}
              onBlur={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n > 0) {
                  onSave({ [WELL_BOTTOMHOLE_TVD_M]: n });
                }
              }}
            />
          );
        },
      },
      {
        title: 'Вход',
        key: 'entry',
        render: (_, bottomhole) => {
          const props = bottomhole.properties ?? {};
          const isGsHeel =
            bottomhole.subtype === 'well_bottomhole_gs_heel' ||
            bottomhole.subtype === 'well_bottomhole_gs';
          const gsEntryMode = readGsEntryMode(props);
          const onSave = (properties: Record<string, unknown>) =>
            saveBottomholeMut.mutate({
              objectId: bottomhole.id,
              properties: { ...props, ...properties },
            });
          if (!isGsHeel) {
            return <span className="pad-clustering-bottomholes-table__na">—</span>;
          }
          return (
            <AppSelect
              variant="compact"
              className="pad-clustering-bottomholes-table__input"
              disabled={readOnly || saveBottomholeMut.isPending}
              value={gsEntryMode}
              key={`${bottomhole.id}-entry-${gsEntryMode}`}
              ariaLabel={`Точка входа для ${bottomhole.name}`}
              onChange={(value) =>
                onSave({
                  [WELL_BOTTOMHOLE_GS_ENTRY_MODE]: value || DEFAULT_GS_ENTRY_MODE,
                })
              }
              options={GS_ENTRY_MODE_OPTIONS.map((opt) => ({
                value: opt.value,
                label: opt.label,
              }))}
            />
          );
        },
      },
    ],
    [readOnly, saveBottomholeMut],
  );

  return (
    <PadClusteringCollapsibleSection
      id="pad-clustering-section-bottomholes"
      title="Забои"
      icon={<Target size={15} strokeWidth={2} aria-hidden />}
      badge={
        <span
          className={`pad-clustering-badge ${
            bottomholes.length > 0 ? 'pad-clustering-badge--ok' : 'pad-clustering-badge--warn'
          }`}
        >
          {bottomholes.length > 0 ? bottomholes.length : '0'}
        </span>
      }
      hint="TVD и точка входа — параметры для проектирования траектории."
      defaultOpen={bottomholes.length > 0}
    >
      {bottomholes.length === 0 ? (
        <div className="pad-clustering-empty-inline">
          <p>Нет привязанных объектов-забоев.</p>
          <ProjectLink to="/map">
            <Button size="small" icon={<MapPin size={14} />}>
              Добавить на карте
            </Button>
          </ProjectLink>
        </div>
      ) : (
        <AppDataTable
          className="pad-clustering-table pad-clustering-bottomholes-table"
          rowKey="id"
          columns={columns}
          dataSource={orderedBottomholes}
          scroll={{}}
          rowClassName={(record) =>
            isLateralBottomhole(record) ? 'pad-clustering-bottomholes-table__row--child' : ''
          }
        />
      )}
    </PadClusteringCollapsibleSection>
  );
}
