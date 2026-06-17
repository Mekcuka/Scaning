import type { InfraObject } from '../api';
import { SUBTYPE_LABELS } from '../api';
import type { PyWellGeoTreeRecord } from '../api/pywellgeoApi';
import type { WellTrajectory } from '../api/wellTrajectoryApi';
import type { PadClusteringCalcDraft } from './padClusteringCalcSettings';
import { countTreeNodes, wellLabel } from './padClusteringPyWellGeoSettings';
import {
  GS_ENTRY_MODE_OPTIONS,
  GS_HEEL_LABEL,
  GS_TOE_LABEL,
  WELL_BOTTOMHOLE_GS_HEEL_ID,
  WELL_BOTTOMHOLE_TARGET_AZI,
  WELL_BOTTOMHOLE_TARGET_INC,
  isGsBottomholeLine,
  isGsBottomholeSubtype,
  orderBottomholesHierarchical,
  readBottomholeParentId,
  readBottomholeRole,
  readBottomholeTvdM,
  readBottomholeWellIndexForObject,
  readGsEntryMode,
  readGsHeelTvdM,
  readGsLineEndpoints,
  readGsToeTvdM,
} from '../wellBottomholeProperties';

export type SummaryRow = {
  key?: string;
  label: string;
  value: string;
  /** Nested column group header (e.g. Т1 → X | Y). */
  headerGroup?: string;
};

export type TransposedSummaryColumn =
  | { kind: 'single'; key: string; label: string }
  | { kind: 'group'; label: string; columns: { key: string; label: string }[] };

export type TransposedSummaryTable = {
  columns: TransposedSummaryColumn[];
  /** Flat value keys in column order. */
  paramLabels: string[];
  rows: { key: string; label: string; values: Record<string, string> }[];
};

function summaryRowKey(row: SummaryRow): string {
  return row.key ?? row.label;
}

function buildTransposedColumnsFromParams(
  groups: { rowLabel: string; params: SummaryRow[] }[],
): TransposedSummaryColumn[] {
  const columns: TransposedSummaryColumn[] = [];
  const seenKeys = new Set<string>();
  const groupByLabel = new Map<string, Extract<TransposedSummaryColumn, { kind: 'group' }>>();

  for (const group of groups) {
    for (const param of group.params) {
      const key = summaryRowKey(param);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      if (param.headerGroup) {
        let colGroup = groupByLabel.get(param.headerGroup);
        if (!colGroup) {
          colGroup = { kind: 'group', label: param.headerGroup, columns: [] };
          groupByLabel.set(param.headerGroup, colGroup);
          columns.push(colGroup);
        }
        colGroup.columns.push({ key, label: param.label });
      } else {
        columns.push({ kind: 'single', key, label: param.label });
      }
    }
  }
  return columns;
}

function flatColumnKeys(columns: TransposedSummaryColumn[]): string[] {
  return columns.flatMap((col) =>
    col.kind === 'single' ? [col.key] : col.columns.map((child) => child.key),
  );
}

/** Pin single columns by label; grouped columns keep relative order at the end. */
function reorderSummaryTableColumns(
  table: TransposedSummaryTable,
  leadingLabels: string[],
): TransposedSummaryTable {
  const singles: Extract<TransposedSummaryColumn, { kind: 'single' }>[] = [];
  const groups: Extract<TransposedSummaryColumn, { kind: 'group' }>[] = [];
  for (const col of table.columns) {
    if (col.kind === 'single') singles.push(col);
    else groups.push(col);
  }
  const byLabel = new Map(singles.map((col) => [col.label, col]));
  const orderedSingles: typeof singles = [];
  const used = new Set<string>();
  for (const label of leadingLabels) {
    const col = byLabel.get(label);
    if (col) {
      orderedSingles.push(col);
      used.add(label);
    }
  }
  for (const col of singles) {
    if (!used.has(col.label)) orderedSingles.push(col);
  }
  const columns = [...orderedSingles, ...groups];
  return { ...table, columns, paramLabels: flatColumnKeys(columns) };
}

const BOTTOMHOLE_SUMMARY_LEADING_COLUMNS = ['Куст', 'Скважина №'];

/** Parameters as columns, entities as rows. */
export function buildTransposedSummaryTable(
  groups: { rowLabel: string; rowKey?: string; params: SummaryRow[] }[],
): TransposedSummaryTable {
  const columns = buildTransposedColumnsFromParams(groups);
  const paramLabels = flatColumnKeys(columns);
  const rows = groups.map((group, index) => ({
    key: group.rowKey ?? `${group.rowLabel}:${index}`,
    label: group.rowLabel,
    values: Object.fromEntries(group.params.map((param) => [summaryRowKey(param), param.value])),
  }));
  return { columns, paramLabels, rows };
}

export function buildPadSummaryTable(padRows: SummaryRow[], padId?: string): TransposedSummaryTable {
  if (padRows.length === 0) {
    return { columns: [], paramLabels: [], rows: [] };
  }
  return buildTransposedSummaryTable([
    { rowLabel: 'Куст', rowKey: padId ?? 'pad', params: padRows },
  ]);
}

/** One row per pad; params as columns (excludes duplicate «Имя»). */
export function buildPadsSummaryTable(
  entries: { padId: string; rows: SummaryRow[] }[],
): TransposedSummaryTable {
  if (entries.length === 0) {
    return { columns: [], paramLabels: [], rows: [] };
  }
  const groups = entries.map(({ padId, rows }) => {
    const rowLabel = rows.find((row) => row.label === 'Имя')?.value ?? padId;
    const params = rows.filter((row) => row.label !== 'Имя');
    return { rowLabel, rowKey: padId, params };
  });
  return buildTransposedSummaryTable(groups);
}

export function buildBottomholeSummaryTable(
  bottomholeGroups: SummaryRow[][],
  objectIds: string[] = [],
  padNames: string[] = [],
): TransposedSummaryTable {
  const groups = bottomholeGroups.map((group, index) => {
    const name = group.find((row) => row.label === 'Имя')?.value ?? '—';
    const role = group.find((row) => row.label === 'Роль')?.value ?? '';
    const isLateral = role === 'Доп.ствол';
    const rowLabel = isLateral ? `Доп.ствол · ${name}` : `Забой · ${name}`;
    const padName = padNames[index]?.trim();
    const params = group.filter((row) => row.label !== 'Отступ' && row.label !== 'Имя');
    if (padName) {
      params.unshift({ label: 'Куст', value: padName });
    }
    return {
      rowLabel,
      rowKey: objectIds[index] ?? `${rowLabel}:${index}`,
      params,
    };
  });
  return reorderSummaryTableColumns(
    buildTransposedSummaryTable(groups),
    BOTTOMHOLE_SUMMARY_LEADING_COLUMNS,
  );
}

export type UnifiedSummaryRow =
  | { kind: 'data'; section: string; entity: string; label: string; value: string }
  | { kind: 'empty'; section: string; hint: string };

function appendDataRows(
  out: UnifiedSummaryRow[],
  section: string,
  entity: string,
  rows: SummaryRow[],
): void {
  for (const row of rows) {
    out.push({ kind: 'data', section, entity, label: row.label, value: row.value });
  }
}

export function buildUnifiedSummaryRows(input: {
  padRows: SummaryRow[];
  wellengRows: SummaryRow[];
  trajectoryGroups: SummaryRow[][];
  bottomholeGroups: SummaryRow[][];
  pywellgeoGroups: SummaryRow[][];
  emptyHints: {
    trajectories: string;
    bottomholes: string;
    pywellgeo: string;
  };
}): UnifiedSummaryRow[] {
  const out: UnifiedSummaryRow[] = [];

  if (input.padRows.length > 0) {
    appendDataRows(out, 'Куст', '—', input.padRows);
  }

  if (input.wellengRows.length > 0) {
    appendDataRows(out, 'Параметры welleng', '—', input.wellengRows);
  }

  if (input.trajectoryGroups.length === 0) {
    out.push({ kind: 'empty', section: 'Скважины (основной ствол)', hint: input.emptyHints.trajectories });
  } else {
    for (const group of input.trajectoryGroups) {
      const entity =
        group.find((r) => r.label === 'Имя')?.value ??
        group.find((r) => r.label === '№')?.value ??
        '—';
      appendDataRows(out, 'Скважины (основной ствол)', entity, group);
    }
  }

  if (input.bottomholeGroups.length === 0) {
    out.push({ kind: 'empty', section: 'Забои на кусте', hint: input.emptyHints.bottomholes });
  } else {
    for (const group of input.bottomholeGroups) {
      const name = group.find((r) => r.label === 'Имя')?.value ?? '—';
      const isLateral = group.some((r) => r.label === 'Отступ');
      const entity = isLateral ? `↳ ${name}` : name;
      const rows = group.filter((r) => r.label !== 'Отступ');
      appendDataRows(out, 'Забои на кусте', entity, rows);
    }
  }

  if (input.pywellgeoGroups.length === 0) {
    out.push({ kind: 'empty', section: 'PyWellGeo', hint: input.emptyHints.pywellgeo });
  } else {
    for (const group of input.pywellgeoGroups) {
      const entity = group.find((r) => r.label === 'Имя')?.value ?? '—';
      appendDataRows(out, 'PyWellGeo', entity, group);
    }
  }

  return out;
}

function fmtNum(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('ru-RU', { maximumFractionDigits: digits });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ru-RU');
  } catch {
    return iso;
  }
}

function fmtCoord(value: number | null | undefined, digits = 6): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return fmtNum(value, digits);
}

function pushCoordPairRows(
  rows: SummaryRow[],
  groupLabel: string,
  keyPrefix: string,
  lon: number | null | undefined,
  lat: number | null | undefined,
): void {
  rows.push(
    { key: `${keyPrefix}.x`, headerGroup: groupLabel, label: 'X', value: fmtCoord(lon) },
    { key: `${keyPrefix}.y`, headerGroup: groupLabel, label: 'Y', value: fmtCoord(lat) },
  );
}

function haversineM(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtGsEntryModeLabel(props: Record<string, unknown> | undefined): string {
  const mode = readGsEntryMode(props);
  return GS_ENTRY_MODE_OPTIONS.find((opt) => opt.value === mode)?.label ?? mode;
}

function readBottomholeTargetInc(props: Record<string, unknown> | undefined): number | null {
  const raw = props?.[WELL_BOTTOMHOLE_TARGET_INC];
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

function readBottomholeTargetAzi(props: Record<string, unknown> | undefined): number | null {
  const raw = props?.[WELL_BOTTOMHOLE_TARGET_AZI];
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

function trajectoryForWellIndex(
  wellIndex: number | null,
  trajectories: WellTrajectory[],
): WellTrajectory | null {
  if (wellIndex == null) return null;
  return trajectories.find((well) => well.well_index === wellIndex) ?? null;
}

function gsPlanLengthM(bh: InfraObject): number | null {
  if (isGsBottomholeLine(bh)) {
    const endpoints = readGsLineEndpoints(bh);
    if (!endpoints) return null;
    return haversineM(
      endpoints.heelLon,
      endpoints.heelLat,
      endpoints.toeLon,
      endpoints.toeLat,
    );
  }
  return null;
}

/** Max MD along a well trajectory (last station MD). */
export function trajectoryMdMaxMeters(well: WellTrajectory): number {
  const stations = well.survey?.stations ?? [];
  return stations.reduce((max, s) => Math.max(max, s.md ?? 0), 0);
}

/** Max horizontal displacement of well trajectory from wellhead (plan view, м). */
export function trajectoryHorizontalReachM(well: WellTrajectory): number | null {
  const stations = well.survey?.stations ?? [];
  let max = 0;
  let hasCoords = false;
  for (const s of stations) {
    const n = Number(s.n ?? 0);
    const e = Number(s.e ?? 0);
    if (!Number.isFinite(n) || !Number.isFinite(e)) continue;
    const r = Math.hypot(n, e);
    if (r > max) max = r;
    hasCoords = true;
  }
  return hasCoords && max > 0 ? max : null;
}
export function sumTrajectoryMdMeters(trajectories: WellTrajectory[]): number | null {
  if (trajectories.length === 0) return null;
  let sum = 0;
  let hasMd = false;
  for (const well of trajectories) {
    const mdMax = trajectoryMdMaxMeters(well);
    if (mdMax > 0) {
      sum += mdMax;
      hasMd = true;
    }
  }
  return hasMd ? sum : null;
}

export function buildPadSummaryRows(input: {
  pad: InfraObject | null;
  kbM: number;
  wellsLocalCount: number;
  trajectoryComputedAt: string | null;
  demSource: string | null;
  trajectories?: WellTrajectory[];
}): SummaryRow[] {
  const { pad, kbM, wellsLocalCount, trajectoryComputedAt, demSource, trajectories = [] } =
    input;
  if (!pad) return [];
  const totalMdM = sumTrajectoryMdMeters(trajectories);
  return [
    { label: 'Имя', value: pad.name },
    { label: 'Тип', value: SUBTYPE_LABELS[pad.subtype] ?? pad.subtype },
    { label: 'KB, м', value: fmtNum(kbM, 2) },
    { label: 'Расчёт траекторий', value: fmtDate(trajectoryComputedAt) },
    { label: 'Устьев на площадке', value: String(wellsLocalCount) },
    { label: 'Суммарный MD, м', value: totalMdM != null ? fmtNum(totalMdM, 1) : '—' },
    { label: 'DEM', value: demSource?.trim() || '—' },
  ];
}

export function buildWellengSummaryRows(
  calcDraft: PadClusteringCalcDraft,
  trajectorySettings: {
    default_error_model?: string;
    default_azi_reference?: string;
    sf_warning_threshold?: number;
    step_m?: number;
    stub_tvd_m?: number;
    default_target_tvd_m?: number | null;
    inc_heel?: number;
    gs_entry_search_step_m?: number;
  } | null,
): SummaryRow[] {
  return [
    { label: 'Шаг MD, м', value: calcDraft.stepM },
    { label: 'Модель погрешности', value: calcDraft.errorModel },
    { label: 'Азимут (reference)', value: calcDraft.aziReference },
    { label: 'Stub TVD, м', value: calcDraft.stubTvdM },
    { label: 'Default TVD, м', value: calcDraft.defaultTvdM },
    { label: 'Порог SF', value: calcDraft.sfWarningThreshold },
    { label: 'Inc heel, °', value: calcDraft.incHeel },
    { label: 'DLS проектирования, °/30 м', value: calcDraft.dlsDesign },
    { label: 'Шаг поиска входа ГС, м', value: calcDraft.gsEntrySearchStepM },
    {
      label: 'Оболочка',
      value: calcDraft.envelopeEnabled
        ? `вкл., ${calcDraft.envelopeWrapWidthM} м`
        : 'выкл.',
    },
    {
      label: 'Settings (last)',
      value: trajectorySettings
        ? `${trajectorySettings.default_error_model ?? '—'} / ${trajectorySettings.default_azi_reference ?? '—'}`
        : '—',
    },
  ];
}

export function buildTrajectorySummaryRows(trajectories: WellTrajectory[]): SummaryRow[][] {
  return trajectories.map((well) => {
    const stations = well.survey?.stations ?? [];
    const mdMax = trajectoryMdMaxMeters(well);
    const minSf = well.clearance?.min_sf;
    const hasDesign = stations.length >= 2;
    return [
      { label: '№', value: String(well.well_index + 1) },
      { label: 'Имя', value: wellLabel(well.well_index, well.name) },
      { label: 'Статус', value: hasDesign ? 'design' : 'нет survey' },
      {
        label: 'TVD target, м',
        value: well.target?.tvd_m != null ? fmtNum(well.target.tvd_m, 1) : '—',
      },
      {
        label: 'Inc / Azi',
        value:
          well.target?.inc != null || well.target?.azi != null
            ? `${fmtNum(well.target?.inc, 1)} / ${fmtNum(well.target?.azi, 1)}`
            : '—',
      },
      { label: 'MD max, м', value: mdMax > 0 ? fmtNum(mdMax, 1) : '—' },
      { label: 'Min SF', value: minSf != null ? fmtNum(minSf, 3) : '—' },
      { label: 'Survey source', value: well.survey?.source?.trim() || '—' },
    ];
  });
}

export function buildBottomholeSummaryRows(
  bottomholes: InfraObject[],
  nameById: Map<string, string>,
  trajectories: WellTrajectory[] = [],
): SummaryRow[][] {
  return orderBottomholesHierarchical(bottomholes).map((bh) => {
    const props = bh.properties ?? {};
    const role = readBottomholeRole(props);
    const parentId = readBottomholeParentId(props);
    const wellIndex = readBottomholeWellIndexForObject(bh, bottomholes);
    const isGs = isGsBottomholeSubtype(bh.subtype);
    const isGsLine = isGsBottomholeLine(bh);
    const gsEndpoints = isGsLine ? readGsLineEndpoints(bh) : null;
    const gsLengthM = gsPlanLengthM(bh);
    const targetInc = readBottomholeTargetInc(props);
    const targetAzi = readBottomholeTargetAzi(props);
    const trajectory = trajectoryForWellIndex(wellIndex, trajectories);
    const mdMax = trajectory ? trajectoryMdMaxMeters(trajectory) : 0;
    const horizontalReach = trajectory ? trajectoryHorizontalReachM(trajectory) : null;
    const minSf = trajectory?.clearance?.min_sf;
    const hasDesign = (trajectory?.survey?.stations?.length ?? 0) >= 2;
    const gsHeelIdRaw = props[WELL_BOTTOMHOLE_GS_HEEL_ID];
    const gsHeelId = typeof gsHeelIdRaw === 'string' && gsHeelIdRaw.length > 0 ? gsHeelIdRaw : null;

    const rows: SummaryRow[] = [
      { label: 'Имя', value: bh.name },
      { label: 'Роль', value: role === 'lateral' ? 'Доп.ствол' : 'Основной' },
      { label: 'Тип', value: SUBTYPE_LABELS[bh.subtype] ?? bh.subtype },
      {
        label: 'Скважина №',
        value: wellIndex != null ? String(wellIndex + 1) : '—',
      },
      { label: 'Отход, м', value: fmtNum(horizontalReach, 1) },
    ];

    if (isGs) {
      rows.push(
        { label: `TVD ${GS_HEEL_LABEL}, м`, value: fmtNum(readGsHeelTvdM(props), 1) },
        { label: `TVD ${GS_TOE_LABEL}, м`, value: fmtNum(readGsToeTvdM(props), 1) },
      );
    }

    if (targetInc != null) {
      rows.push({ label: 'Inc, °', value: fmtNum(targetInc, 1) });
    }
    if (targetAzi != null) {
      rows.push({ label: 'Azi, °', value: fmtNum(targetAzi, 1) });
    }

    if (isGsLine || bh.subtype === 'well_bottomhole_gs_heel') {
      rows.push({ label: 'Точка входа', value: fmtGsEntryModeLabel(props) });
    }

    if (gsLengthM != null) {
      rows.push({ label: 'Длина ГС, м', value: fmtNum(gsLengthM, 0) });
    }

    if (gsEndpoints) {
      pushCoordPairRows(rows, GS_HEEL_LABEL, 'gs.t1', gsEndpoints.heelLon, gsEndpoints.heelLat);
      pushCoordPairRows(rows, GS_TOE_LABEL, 'gs.t3', gsEndpoints.toeLon, gsEndpoints.toeLat);
    } else {
      pushCoordPairRows(rows, 'Точка', 'point', bh.lon, bh.lat);
    }

    if (parentId) {
      rows.push({
        label: 'Родитель',
        value: nameById.get(parentId) ?? parentId,
      });
    }

    if (gsHeelId) {
      rows.push({
        label: `Связь ${GS_HEEL_LABEL}`,
        value: nameById.get(gsHeelId) ?? gsHeelId,
      });
    }

    rows.push(
      {
        label: 'MD max, м',
        value: mdMax > 0 ? fmtNum(mdMax, 1) : '—',
      },
      {
        label: 'Min SF',
        value: minSf != null ? fmtNum(minSf, 3) : '—',
      },
      {
        label: 'Траектория',
        value: trajectory ? (hasDesign ? 'design' : 'нет survey') : '—',
      },
    );

    return rows;
  });
}

export function buildPyWellGeoSummaryRows(
  trees: PyWellGeoTreeRecord[],
  computedAt: string | null,
): SummaryRow[][] {
  return trees.map((record) => {
    const nodeCount = countTreeNodes(record.tree);
    const stats = record.branch_stats ?? [];
    const ahdParts = stats
      .map((s) => s.ahd_m ?? s.AHD ?? s.ahd)
      .filter((v) => typeof v === 'number' && Number.isFinite(v));
    const dlsParts = stats
      .map((s) => s.max_dls ?? s.max_DLS ?? s.dls)
      .filter((v) => typeof v === 'number' && Number.isFinite(v));
    return [
      { label: 'well_index', value: String(record.well_index + 1) },
      { label: 'Имя', value: record.name?.trim() || wellLabel(record.well_index) },
      { label: 'Узлов', value: String(nodeCount) },
      {
        label: 'AHD (ветки)',
        value: ahdParts.length ? ahdParts.map((v) => fmtNum(v as number, 1)).join(', ') : '—',
      },
      {
        label: 'Max DLS',
        value: dlsParts.length ? dlsParts.map((v) => fmtNum(v as number, 2)).join(', ') : '—',
      },
      { label: 'computed_at', value: fmtDate(computedAt) },
    ];
  });
}
