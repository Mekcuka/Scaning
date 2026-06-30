import { useMemo, useState } from 'react';
import { Button } from 'antd';
import { LINE_SUBTYPES, SUBTYPE_LABELS, type InfraObject } from '../../lib/api';
import {
  FOOTPRINT_CARDINAL_OPTIONS,
  applyFootprintTemplateToObject,
  cardinalDirectionFromEdgeIndex,
  footprintAttachCardinalSelectValue,
  footprintAttachFromCardinalSelect,
  footprintRingEdges,
  type FootprintCardinalDirection,
  type FootprintEdgeAttach,
  type FootprintLineConnectionTemplate,
  type PointFootprintLineConnections,
} from '../../lib/padFootprintLineAttach';
import { resolveFootprintLonLat } from '../../lib/padFootprintGeo';
import { AppSelect } from '../AppSelect';
import { DeferredNumberInput } from '../DeferredNumberInput';
import { FootprintPerimeterPicker } from './FootprintPerimeterPicker';
import { FieldLabel, PanelSection } from './panelUi';

interface PointFootprintLineConnectionsSectionProps {
  readOnly: boolean;
  point: InfraObject;
  connections: PointFootprintLineConnections;
  onConnectionsChange: (next: PointFootprintLineConnections) => void;
  mapInFootprints: boolean;
  projectTemplate?: FootprintLineConnectionTemplate;
  templateLoading?: boolean;
}

export function PointFootprintLineConnectionsSection({
  readOnly,
  point,
  connections,
  onConnectionsChange,
  mapInFootprints,
  projectTemplate,
  templateLoading = false,
}: PointFootprintLineConnectionsSectionProps) {
  const ring = useMemo(() => resolveFootprintLonLat(point), [point]);
  const edges = useMemo(() => (ring ? footprintRingEdges(ring) : []), [ring]);
  const useCardinalSelect = edges.length === 4;
  const [activeLineSubtype, setActiveLineSubtype] = useState<string>(LINE_SUBTYPES[0]!);

  if (!ring) return null;

  const editable = !readOnly;
  const activeAttach = connections[activeLineSubtype];
  const cardinalValue = footprintAttachCardinalSelectValue(ring, activeAttach);
  const activeT = activeAttach?.t ?? 0.5;
  const templateHasEntries =
    projectTemplate != null && Object.keys(projectTemplate).length > 0;

  const setConnection = (lineSubtype: string, attach: FootprintEdgeAttach | null) => {
    const next = { ...connections };
    if (attach) next[lineSubtype] = attach;
    else delete next[lineSubtype];
    onConnectionsChange(next);
  };

  const applyProjectTemplate = () => {
    if (!projectTemplate || !templateHasEntries) return;
    const resolved = applyFootprintTemplateToObject(point, projectTemplate, 'merge');
    if (!resolved) return;
    onConnectionsChange({ ...connections, ...resolved });
  };

  return (
    <PanelSection title="Точки подключения линий" card>
      <p className="object-detail-panel__hint">
        Для каждого типа линейного объекта укажите точку на контуре площадки. Сторона света
        (Север / Юг / …) сохраняется с учётом поворота площадки; номер ребра пересчитывается
        автоматически. Изменения сохраняются сразу.
      </p>
      {editable && templateHasEntries && (
        <div className="footprint-line-connect__template-row">
          <Button size="small" loading={templateLoading} onClick={applyProjectTemplate}>
            Применить шаблон проекта
          </Button>
        </div>
      )}
      <div className="object-detail-panel__segment-row footprint-line-connect__subtype-row">
        {LINE_SUBTYPES.map((st) => {
          const configured = st in connections;
          return (
            <Button
              key={st}
              size="small"
              type={activeLineSubtype === st ? 'primary' : 'default'}
              onClick={() => setActiveLineSubtype(st)}
            >
              {SUBTYPE_LABELS[st] ?? st}
              {configured && (
                <span className="footprint-connect-template__chip-dot" aria-hidden>
                  ·
                </span>
              )}
            </Button>
          );
        })}
      </div>
      <div className="object-detail-panel__field object-detail-panel__field--stack">
        <FieldLabel>{SUBTYPE_LABELS[activeLineSubtype] ?? activeLineSubtype}</FieldLabel>
        <FootprintPerimeterPicker
          ring={ring}
          anchorLon={point.lon}
          anchorLat={point.lat}
          attach={activeAttach}
          readOnly={!editable}
          onPick={(edgeIndex, t) => {
            if (useCardinalSelect) {
              const cardinal = cardinalDirectionFromEdgeIndex(ring, edgeIndex);
              if (cardinal) {
                const attach = footprintAttachFromCardinalSelect(ring, cardinal, t);
                if (attach) setConnection(activeLineSubtype, attach);
                return;
              }
            }
            setConnection(activeLineSubtype, { edge_index: edgeIndex, t });
          }}
        />
        <div className="object-detail-panel__field-control footprint-line-connect__side-row">
          {useCardinalSelect ? (
            <>
              <AppSelect
                variant="compact"
                value={cardinalValue}
                readOnly={!editable}
                placeholder="Не задано"
                onChange={(value) => {
                  if (!value) {
                    setConnection(activeLineSubtype, null);
                    return;
                  }
                  if (value === '__center__') {
                    setConnection(activeLineSubtype, null);
                    return;
                  }
                  const attach = footprintAttachFromCardinalSelect(
                    ring,
                    value as FootprintCardinalDirection,
                    activeT,
                  );
                  setConnection(activeLineSubtype, attach);
                }}
                options={[
                  { value: '', label: 'Не задано' },
                  { value: '__center__', label: 'К центру площадки' },
                  ...FOOTPRINT_CARDINAL_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  })),
                ]}
              />
              {cardinalValue !== '' && cardinalValue !== '__center__' && (
                <label className="footprint-connect-template__t-field">
                  <span className="footprint-connect-template__t-label">t</span>
                  <DeferredNumberInput
                    min={0}
                    max={1}
                    className="parameters-table__input footprint-connect-template__t-input"
                    value={activeT}
                    readOnly={!editable}
                    onCommit={(v) => {
                      if (v == null || !Number.isFinite(v)) return;
                      const attach = footprintAttachFromCardinalSelect(
                        ring,
                        cardinalValue as FootprintCardinalDirection,
                        v,
                      );
                      setConnection(activeLineSubtype, attach);
                    }}
                  />
                </label>
              )}
            </>
          ) : (
            <AppSelect
              variant="compact"
              value={activeAttach != null ? String(activeAttach.edge_index) : ''}
              readOnly={!editable}
              placeholder="К центру площадки"
              onChange={(value) => {
                if (!value) {
                  setConnection(activeLineSubtype, null);
                } else {
                  setConnection(activeLineSubtype, {
                    edge_index: Number(value),
                    t: activeAttach?.t ?? 0.5,
                  });
                }
              }}
              options={[
                { value: '', label: 'К центру площадки' },
                ...edges.map((e) => ({
                  value: String(e.edgeIndex),
                  label: e.label,
                })),
              ]}
            />
          )}
        </div>
      </div>
      {mapInFootprints && editable && (
        <p className="object-detail-panel__hint">
          Или выберите сторону кликом на схеме выше или на карте (кнопка типа линии ниже).
        </p>
      )}
    </PanelSection>
  );
}

export type FootprintLineConnectPickSubtype = string | null;

interface PointFootprintLineConnectPickControlsProps {
  pickLineSubtype: FootprintLineConnectPickSubtype;
  onPickLineSubtypeChange: (lineSubtype: FootprintLineConnectPickSubtype) => void;
  readOnly: boolean;
  mapInFootprints: boolean;
  showSection: boolean;
}

export function PointFootprintLineConnectPickControls({
  pickLineSubtype,
  onPickLineSubtypeChange,
  readOnly,
  mapInFootprints,
  showSection,
}: PointFootprintLineConnectPickControlsProps) {
  if (!mapInFootprints || readOnly || !showSection) return null;

  return (
    <div className="object-detail-panel__segment-row">
      <span className="object-detail-panel__hint">Выбор ребра на карте:</span>
      <div className="object-detail-panel__segment-group footprint-line-connect__subtype-row">
        {LINE_SUBTYPES.map((st) => (
          <Button
            key={st}
            size="small"
            type={pickLineSubtype === st ? 'primary' : 'default'}
            onClick={() => onPickLineSubtypeChange(pickLineSubtype === st ? null : st)}
          >
            {SUBTYPE_LABELS[st] ?? st}
          </Button>
        ))}
      </div>
    </div>
  );
}

