import { Copy, MapPin } from 'lucide-react';
import type { InfraObject } from '../../lib/api';
import { coordStringForCopy, numberStringForCopy } from '../../lib/coords';
import { formatLengthMeters, lineLengthMeters } from '../../lib/mapMeasure';
import {
  bottomholeShowsEndPoint,
  formatBottomholeElevation,
  gsBottomhole3dLengthMeters,
  readPadKbM,
  tvdFromElevation,
  type BottomholeCopySources,
} from '../../lib/wellBottomholeElevation';import {
  WELL_BOTTOMHOLE_HEEL_TVD_M,
  WELL_BOTTOMHOLE_TOE_TVD_M,
  WELL_BOTTOMHOLE_TVD_M,
} from '../../lib/wellBottomholeProperties';
import { DeferredNumberInput } from '../DeferredNumberInput';
import { FieldLabel, PanelSection, StatChip } from './panelUi';

interface InfraBottomholeGeometrySectionProps {
  readOnly: boolean;
  subtype: string;
  lon: string;
  setLon: (value: string) => void;
  lat: string;
  setLat: (value: string) => void;
  endLon: string;
  setEndLon: (value: string) => void;
  endLat: string;
  setEndLat: (value: string) => void;
  z: string;
  setZ: (value: string) => void;
  zHeel: string;
  setZHeel: (value: string) => void;
  zToe: string;
  setZToe: (value: string) => void;
  linkedPad: InfraObject | null;
  copySources: BottomholeCopySources;
  onBottomholePropsChange: (patch: Record<string, unknown>) => void;
  onCopyCoordinates: (text: string) => Promise<void>;
}

function parseCoordField(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function parseElevationField(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function gsLineLengthLabel(
  lon: string,
  lat: string,
  endLon: string,
  endLat: string,
  zHeel: string,
  zToe: string,
): string | null {
  const heelLon = parseCoordField(lon);
  const heelLat = parseCoordField(lat);
  const toeLon = parseCoordField(endLon);
  const toeLat = parseCoordField(endLat);
  if (heelLon == null || heelLat == null || toeLon == null || toeLat == null) return null;
  const planM = lineLengthMeters([
    [heelLon, heelLat],
    [toeLon, toeLat],
  ]);
  const heelZ = parseElevationField(zHeel);
  const toeZ = parseElevationField(zToe);
  const lengthM =
    heelZ != null && toeZ != null
      ? gsBottomhole3dLengthMeters(planM, heelZ, toeZ)
      : planM;
  return formatLengthMeters(lengthM);
}

function BottomholeXyzRow({
  readOnly,
  x,
  setX,
  y,
  setY,
  z,
  onCommitZ,
}: {
  readOnly: boolean;
  x: string;
  setX: (value: string) => void;
  y: string;
  setY: (value: string) => void;
  z: string;
  onCommitZ: (value: number | '') => void;
}) {
  return (
    <div className="object-detail-panel__coord-grid object-detail-panel__coord-grid--xyz">
      <label className="object-detail-panel__field">
        <FieldLabel>X</FieldLabel>
        <input
          className="input object-detail-panel__input object-detail-panel__input--mono"
          value={x}
          inputMode="decimal"
          readOnly={readOnly}
          disabled={readOnly}
          onChange={(e) => setX(e.target.value)}
        />
      </label>
      <label className="object-detail-panel__field">
        <FieldLabel>Y</FieldLabel>
        <input
          className="input object-detail-panel__input object-detail-panel__input--mono"
          value={y}
          inputMode="decimal"
          readOnly={readOnly}
          disabled={readOnly}
          onChange={(e) => setY(e.target.value)}
        />
      </label>
      <label className="object-detail-panel__field">
        <FieldLabel>Z</FieldLabel>
        {readOnly ? (
          <input
            className="input object-detail-panel__input object-detail-panel__input--mono"
            value={z}
            readOnly
            disabled
          />
        ) : (
          <DeferredNumberInput
            allowEmpty
            className="input object-detail-panel__input object-detail-panel__input--mono"
            placeholder="—"
            value={z}
            onCommit={onCommitZ}
          />
        )}
      </label>
    </div>
  );
}

export function InfraBottomholeGeometrySection({
  readOnly,
  subtype,
  lon,
  setLon,
  lat,
  setLat,
  endLon,
  setEndLon,
  endLat,
  setEndLat,
  z,
  setZ,
  zHeel,
  setZHeel,
  zToe,
  setZToe,
  linkedPad,
  copySources,
  onBottomholePropsChange,
  onCopyCoordinates,
}: InfraBottomholeGeometrySectionProps) {
  const showEndPoint = bottomholeShowsEndPoint(subtype);
  const lengthLabel = showEndPoint
    ? gsLineLengthLabel(lon, lat, endLon, endLat, zHeel, zToe)
    : null;
  const kbHint = linkedPad ? null : 'Привяжите куст для точного KB';

  const commitPointZ = (value: number | '') => {
    if (value === '' || !Number.isFinite(value)) return;
    setZ(formatBottomholeElevation(value));
    const kbM = readPadKbM(linkedPad);
    onBottomholePropsChange({ [WELL_BOTTOMHOLE_TVD_M]: tvdFromElevation(kbM, value) });
  };

  const commitHeelZ = (value: number | '') => {
    if (value === '' || !Number.isFinite(value)) return;
    setZHeel(formatBottomholeElevation(value));
    const kbM = readPadKbM(linkedPad);
    onBottomholePropsChange({ [WELL_BOTTOMHOLE_HEEL_TVD_M]: tvdFromElevation(kbM, value) });
  };

  const commitToeZ = (value: number | '') => {
    if (value === '' || !Number.isFinite(value)) return;
    setZToe(formatBottomholeElevation(value));
    const kbM = readPadKbM(linkedPad);
    onBottomholePropsChange({ [WELL_BOTTOMHOLE_TOE_TVD_M]: tvdFromElevation(kbM, value) });
  };

  const formatCopyTriple = (
    xDisplay: string,
    yDisplay: string,
    zDisplay: string,
    xSource: number,
    ySource: number,
    zSource: number | undefined,
  ) => {
    const x = coordStringForCopy(xDisplay, xSource);
    const y = coordStringForCopy(yDisplay, ySource);
    const zPart =
      zSource != null && Number.isFinite(zSource)
        ? `, ${numberStringForCopy(zDisplay, zSource, formatBottomholeElevation)}`
        : '';
    return `${x}, ${y}${zPart}`;
  };

  const copyPointCoords = () => {
    void onCopyCoordinates(
      formatCopyTriple(lon, lat, z, copySources.lon, copySources.lat, copySources.z),
    );
  };

  const copyHeelCoords = () => {
    void onCopyCoordinates(
      formatCopyTriple(lon, lat, zHeel, copySources.lon, copySources.lat, copySources.zHeel),
    );
  };

  const copyToeCoords = () => {
    const x =
      copySources.endLon != null
        ? coordStringForCopy(endLon, copySources.endLon)
        : endLon.trim();
    const y =
      copySources.endLat != null
        ? coordStringForCopy(endLat, copySources.endLat)
        : endLat.trim();
    const zPart =
      copySources.zToe != null && Number.isFinite(copySources.zToe)
        ? `, ${numberStringForCopy(zToe, copySources.zToe, formatBottomholeElevation)}`
        : '';
    void onCopyCoordinates(`${x}, ${y}${zPart}`);
  };

  return (
    <PanelSection title="Геометрия забоя" card>
      {showEndPoint && lengthLabel && (
        <div className="object-detail-panel__stats">
          <StatChip>Длина забоя: {lengthLabel}</StatChip>
        </div>
      )}

      <div className="object-detail-panel__coord-card">
        <p className="object-detail-panel__field-label object-detail-panel__field-label--section">
          {showEndPoint ? 'Первая точка (heel)' : 'Координаты забоя'}
        </p>
        <BottomholeXyzRow
          readOnly={readOnly}
          x={lon}
          setX={setLon}
          y={lat}
          setY={setLat}
          z={showEndPoint ? zHeel : z}
          onCommitZ={showEndPoint ? commitHeelZ : commitPointZ}
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm object-detail-panel__copy-btn object-detail-panel__copy-btn--block"
          onClick={showEndPoint ? copyHeelCoords : copyPointCoords}
        >
          <Copy size={14} aria-hidden />
          Копировать координаты
        </button>
      </div>

      {showEndPoint && (
        <div className="object-detail-panel__coord-card">
          <p className="object-detail-panel__field-label object-detail-panel__field-label--section">
            Конечная точка (toe)
          </p>
          <BottomholeXyzRow
            readOnly={readOnly}
            x={endLon}
            setX={setEndLon}
            y={endLat}
            setY={setEndLat}
            z={zToe}
            onCommitZ={commitToeZ}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm object-detail-panel__copy-btn object-detail-panel__copy-btn--block"
            onClick={copyToeCoords}
          >
            <Copy size={14} aria-hidden />
            Копировать координаты
          </button>
        </div>
      )}

      {kbHint && <p className="object-detail-panel__hint text-xs">{kbHint}</p>}

      <p className="object-detail-panel__hint object-detail-panel__hint--with-icon">
        <MapPin size={12} aria-hidden />
        X и Y можно менять на карте в режиме редактирования; Z — только в панели.
      </p>
    </PanelSection>
  );
}
