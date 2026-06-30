import { ProjectLink } from '../../components/ProjectLink';
import { MapPin, Target } from 'lucide-react';
import { Button, Input } from 'antd';
import { AppSelect } from '../AppSelect';
import type { InfraObject } from '../../lib/api';
import { SUBTYPE_LABELS } from '../../lib/api';
import {
  BOTTOMHOLE_ROLE_OPTIONS,
  DEFAULT_GS_ENTRY_MODE,
  GS_ENTRY_MODE_OPTIONS,
  readGsEntryMode,
  DEFAULT_NNB_INC,
  WELL_BOTTOMHOLE_GS_HEEL_ID,
  WELL_BOTTOMHOLE_GS_ENTRY_MODE,
  WELL_BOTTOMHOLE_TARGET_AZI,
  WELL_BOTTOMHOLE_TARGET_INC,
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
      hint="TVD и углы на забое — вход для проектирования траектории."
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
        <div className="pad-clustering-table-wrap">
          <table className="pad-clustering-table pad-clustering-bottomholes-table">
            <thead>
              <tr>
                <th>Забой</th>
                <th>Роль</th>
                <th>Тип</th>
                <th>Скв. №</th>
                <th>TVD, м</th>
                <th>Inc, °</th>
                <th>Azi, °</th>
                <th>Вход</th>
              </tr>
            </thead>
            <tbody>
              {orderBottomholesHierarchical(bottomholes).map((bh) => (
                <BottomholeRow
                  key={bh.id}
                  bottomhole={bh}
                  isChild={isLateralBottomhole(bh)}
                  readOnly={readOnly}
                  saving={saveBottomholeMut.isPending}
                  onSave={(properties) =>
                    saveBottomholeMut.mutate({
                      objectId: bh.id,
                      properties: { ...bh.properties, ...properties },
                    })
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PadClusteringCollapsibleSection>
  );
}

function BottomholeRow({
  bottomhole,
  isChild,
  readOnly,
  saving,
  onSave,
}: {
  bottomhole: InfraObject;
  isChild?: boolean;
  readOnly: boolean;
  saving: boolean;
  onSave: (properties: Record<string, unknown>) => void;
}) {
  const props = bottomhole.properties ?? {};
  const roleLabel =
    BOTTOMHOLE_ROLE_OPTIONS.find((o) => o.value === readBottomholeRole(props))?.label ?? 'Основной забой';
  const subtypeLabel = SUBTYPE_LABELS[bottomhole.subtype] ?? bottomhole.subtype;
  const tvdM = readBottomholeTvdM(props);
  const wellIndexRaw = props[WELL_BOTTOMHOLE_WELL_INDEX];
  const wellIndex =
    wellIndexRaw === '' || wellIndexRaw == null ? '' : String(wellIndexRaw);
  const targetInc = props[WELL_BOTTOMHOLE_TARGET_INC];
  const targetAzi = props[WELL_BOTTOMHOLE_TARGET_AZI];
  const gsHeelId = props[WELL_BOTTOMHOLE_GS_HEEL_ID];
  const gsEntryMode = readGsEntryMode(props);
  const isNnb = bottomhole.subtype === 'well_bottomhole_nnb';
  const isGsHeel =
    bottomhole.subtype === 'well_bottomhole_gs_heel' ||
    bottomhole.subtype === 'well_bottomhole_gs';
  const showAzi = isNnb || bottomhole.subtype === 'well_bottomhole_gs_toe';

  return (
    <tr className={isChild ? 'pad-clustering-bottomholes-table__row--child' : undefined}>
      <td className="pad-clustering-bottomholes-table__name">
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
      </td>
      <td className="pad-clustering-bottomholes-table__type">{roleLabel}</td>
      <td className="pad-clustering-bottomholes-table__type">{subtypeLabel}</td>
      <td>
        <Input
          className="pad-clustering-bottomholes-table__input"
          type="number"
          min={0}
          max={63}
          disabled={readOnly || saving || isChild}
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
      </td>
      <td>
        <Input
          className="pad-clustering-bottomholes-table__input"
          type="number"
          min={1}
          disabled={readOnly || saving}
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
      </td>
      <td>
        {isNnb ? (
          <Input
            className="pad-clustering-bottomholes-table__input"
            type="number"
            min={0}
            max={360}
            disabled={readOnly || saving}
            defaultValue={targetInc ?? DEFAULT_NNB_INC}
            key={`${bottomhole.id}-inc-${String(targetInc)}`}
            aria-label={`Inc для ${bottomhole.name}`}
            onBlur={(e) => onSave({ [WELL_BOTTOMHOLE_TARGET_INC]: Number(e.target.value) })}
          />
        ) : (
          <span className="pad-clustering-bottomholes-table__na">—</span>
        )}
      </td>
      <td>
        {showAzi ? (
          <Input
            className="pad-clustering-bottomholes-table__input"
            type="number"
            min={0}
            max={360}
            disabled={readOnly || saving}
            defaultValue={targetAzi ?? ''}
            placeholder="NDS"
            key={`${bottomhole.id}-azi-${String(targetAzi)}`}
            aria-label={`Azi для ${bottomhole.name}`}
            onBlur={(e) =>
              onSave({
                [WELL_BOTTOMHOLE_TARGET_AZI]:
                  e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
          />
        ) : (
          <span className="pad-clustering-bottomholes-table__na">—</span>
        )}
      </td>
      <td>
        {isGsHeel ? (
          <AppSelect
            variant="compact"
            className="pad-clustering-bottomholes-table__input"
            disabled={readOnly || saving}
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
        ) : (
          <span className="pad-clustering-bottomholes-table__na">—</span>
        )}
      </td>
    </tr>
  );
}
