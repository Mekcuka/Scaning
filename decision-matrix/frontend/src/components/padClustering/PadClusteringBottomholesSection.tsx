import { ProjectLink } from '../../components/ProjectLink';
import { MapPin, Target } from 'lucide-react';
import type { InfraObject } from '../../lib/api';
import { SUBTYPE_LABELS } from '../../lib/api';
import {
  WELL_BOTTOMHOLE_GS_HEEL_ID,
  WELL_BOTTOMHOLE_GS_ENTRY_MODE,
  DEFAULT_GS_ENTRY_MODE,
  GS_ENTRY_MODE_OPTIONS,
  readGsEntryMode,
  DEFAULT_NNB_INC,
  WELL_BOTTOMHOLE_TARGET_AZI,
  WELL_BOTTOMHOLE_TARGET_INC,
  WELL_BOTTOMHOLE_TVD_M,
  WELL_BOTTOMHOLE_WELL_INDEX,
  readBottomholeTvdM,
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
          <ProjectLink to="/map" className="btn btn--secondary btn--sm">
            <MapPin size={14} aria-hidden />
            Добавить на карте
          </ProjectLink>
        </div>
      ) : (
        <ul className="pad-clustering-bottomholes">
          {bottomholes.map((bh) => (
            <BottomholeRow
              key={bh.id}
              bottomhole={bh}
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
        </ul>
      )}
    </PadClusteringCollapsibleSection>
  );
}

function BottomholeRow({
  bottomhole,
  readOnly,
  saving,
  onSave,
}: {
  bottomhole: InfraObject;
  readOnly: boolean;
  saving: boolean;
  onSave: (properties: Record<string, unknown>) => void;
}) {
  const props = bottomhole.properties ?? {};
  const subtypeLabel = SUBTYPE_LABELS[bottomhole.subtype] ?? bottomhole.subtype;
  const tvdM = readBottomholeTvdM(props);
  const wellIndexRaw = props[WELL_BOTTOMHOLE_WELL_INDEX];
  const wellIndex =
    wellIndexRaw === '' || wellIndexRaw == null ? '' : String(wellIndexRaw);
  const targetInc = props[WELL_BOTTOMHOLE_TARGET_INC];
  const targetAzi = props[WELL_BOTTOMHOLE_TARGET_AZI];
  const gsHeelId = props[WELL_BOTTOMHOLE_GS_HEEL_ID];
  const gsEntryMode = readGsEntryMode(props);

  return (
    <li className="pad-clustering-bottomholes__item">
      <div className="pad-clustering-bottomholes__header">
        <strong>{bottomhole.name}</strong>
        <span className="pad-clustering-bottomholes__subtype">{subtypeLabel}</span>
      </div>
      <div className="pad-clustering-bottomholes__fields">
        <label className="pad-clustering-field">
          <span>Скв. №</span>
          <input
            className="input"
            type="number"
            min={0}
            max={63}
            disabled={readOnly || saving}
            defaultValue={wellIndex}
            key={`${bottomhole.id}-wi-${String(wellIndexRaw)}`}
            onBlur={(e) =>
              onSave({
                [WELL_BOTTOMHOLE_WELL_INDEX]:
                  e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
          />
        </label>
        <label className="pad-clustering-field">
          <span>TVD, м</span>
          <input
            className="input"
            type="number"
            min={1}
            disabled={readOnly || saving}
            defaultValue={tvdM}
            key={`${bottomhole.id}-tvd-${tvdM}`}
            onBlur={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n > 0) {
                onSave({ [WELL_BOTTOMHOLE_TVD_M]: n });
              }
            }}
          />
        </label>
        {bottomhole.subtype === 'well_bottomhole_nnb' && (
          <label className="pad-clustering-field">
            <span>Inc, °</span>
            <input
              className="input"
              type="number"
              min={0}
              max={360}
              disabled={readOnly || saving}
              defaultValue={targetInc ?? DEFAULT_NNB_INC}
              key={`${bottomhole.id}-inc-${String(targetInc)}`}
              onBlur={(e) => onSave({ [WELL_BOTTOMHOLE_TARGET_INC]: Number(e.target.value) })}
            />
          </label>
        )}
        {bottomhole.subtype === 'well_bottomhole_gs_heel' ||
        bottomhole.subtype === 'well_bottomhole_gs' ? (
          <label className="pad-clustering-field pad-clustering-field--span2">
            <span>Точка входа</span>
            <select
              className="input"
              disabled={readOnly || saving}
              defaultValue={gsEntryMode}
              key={`${bottomhole.id}-entry-${gsEntryMode}`}
              onChange={(e) =>
                onSave({
                  [WELL_BOTTOMHOLE_GS_ENTRY_MODE]: e.target.value || DEFAULT_GS_ENTRY_MODE,
                })
              }
            >
              {GS_ENTRY_MODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {(bottomhole.subtype === 'well_bottomhole_nnb' ||
          bottomhole.subtype === 'well_bottomhole_gs_toe') && (
          <label className="pad-clustering-field">
            <span>Azi, °</span>
            <input
              className="input"
              type="number"
              min={0}
              max={360}
              disabled={readOnly || saving}
              defaultValue={targetAzi ?? ''}
              placeholder="NDS"
              key={`${bottomhole.id}-azi-${String(targetAzi)}`}
              onBlur={(e) =>
                onSave({
                  [WELL_BOTTOMHOLE_TARGET_AZI]:
                    e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
            />
          </label>
        )}
      </div>
      {bottomhole.subtype === 'well_bottomhole_gs_toe' && typeof gsHeelId === 'string' && (
        <p className="pad-clustering-section__hint">Пятка (heel) ГС: {gsHeelId.slice(0, 8)}…</p>
      )}
    </li>
  );
}
