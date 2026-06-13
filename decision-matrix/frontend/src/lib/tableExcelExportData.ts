import type {
  InfraObject,
  SandLogisticsConsumerRow,
  SandLogisticsQuarryRow,
  SandLogisticsResult,
} from './api';
import { SUBTYPE_LABELS } from './api';
import type { ExcelColumn } from './exportExcel';
import { capacityUnitLabel, effectiveThroughputCapacity } from './infraCapacity';
import { padParamsFromObject } from './infraPadEarthwork';
import { readEntryDateIso } from './infraEntryDate';
import { readSandDemandM3 } from './infraSandVolumes';
import {
  buildHaulLegRows,
  findSandLogisticsConsumer,
  formatHaulLegKm,
  formatHaulLegM3,
} from './sandLogisticsHaulLegs';
import { subtypeDisplayLabel } from './analysisDisplay';
import { formatEntryDateRu } from './infraEntryDate';

function fmtKmExport(km: number | null | undefined): number | string {
  if (km == null) return '';
  return km;
}

function fmtNumExport(v: number | null | undefined): number | string {
  if (v == null) return '';
  return v;
}

export function haulLegsExportText(consumer: SandLogisticsConsumerRow | null): string {
  if (!consumer || !consumer.in_service) return '';
  const legs = buildHaulLegRows(consumer);
  if (legs.length === 0) return '';
  return legs
    .map(
      (leg) =>
        `${leg.quarry_name}: ${formatHaulLegM3(leg.allocated_m3)} м³, ${formatHaulLegKm(leg.distance_km)}`,
    )
    .join('; ');
}

export function capacityTableExportColumns(): ExcelColumn<InfraObject>[] {
  return [
    { header: 'Объект', value: (o) => o.name },
    { header: 'Подтип', value: (o) => SUBTYPE_LABELS[o.subtype] || o.subtype },
    {
      header: 'Ед. изм.',
      value: (o) => capacityUnitLabel(effectiveThroughputCapacity(o.subtype, o.properties).unit),
    },
    {
      header: 'Пропускная способность',
      value: (o) => {
        const { value } = effectiveThroughputCapacity(o.subtype, o.properties);
        return value != null ? value : '';
      },
    },
  ];
}

export function earthworkTableExportColumns(): ExcelColumn<InfraObject>[] {
  return [
    { header: 'Объект', value: (o) => o.name },
    { header: 'Подтип', value: (o) => SUBTYPE_LABELS[o.subtype] || o.subtype },
    {
      header: 'Длина, м',
      value: (o) => {
        const v = padParamsFromObject(o).lengthM;
        return v ? Number(v) : '';
      },
    },
    {
      header: 'Ширина, м',
      value: (o) => {
        const v = padParamsFromObject(o).widthM;
        return v ? Number(v) : '';
      },
    },
    {
      header: 'Высота насыпи, м',
      value: (o) => {
        const v = padParamsFromObject(o).heightM;
        return v ? Number(v) : '';
      },
    },
    {
      header: 'Опорная отметка, м',
      value: (o) => {
        const v = padParamsFromObject(o).referenceElevationM;
        return v !== '' ? Number(v) : '';
      },
    },
    {
      header: 'Поворот / НДС, °',
      value: (o) => {
        const v = padParamsFromObject(o).rotationDeg;
        return v ? Number(v) : '';
      },
    },
  ];
}

export function sandDemandTableExportColumns(
  sandLogistics: SandLogisticsResult | null | undefined,
): ExcelColumn<InfraObject>[] {
  return [
    { header: 'Объект', value: (o) => o.name },
    { header: 'Подтип', value: (o) => SUBTYPE_LABELS[o.subtype] || o.subtype },
    {
      header: 'Объём песка (спрос), м³',
      value: (o) => {
        const d = readSandDemandM3(o.properties);
        return d > 0 ? d : '';
      },
    },
    {
      header: 'Плечо возки',
      value: (o) =>
        haulLegsExportText(
          sandLogistics ? findSandLogisticsConsumer(sandLogistics, o.id) : null,
        ),
    },
  ];
}

export function entryDateTableExportColumns(): ExcelColumn<InfraObject>[] {
  return [
    { header: 'Объект', value: (o) => o.name },
    { header: 'Подтип', value: (o) => SUBTYPE_LABELS[o.subtype] || o.subtype },
    { header: 'Дата ввода', value: (o) => readEntryDateIso(o.properties) },
  ];
}

export function ratesKeyValueExportColumns(): ExcelColumn<{
  label: string;
  value: number;
}>[] {
  return [
    { header: 'Параметр', value: (r) => r.label },
    { header: 'Значение', value: (r) => r.value },
  ];
}

export function sandQuarryTableExportColumns(): ExcelColumn<SandLogisticsQuarryRow>[] {
  return [
    { header: 'Карьер', value: (r) => r.name },
    { header: 'Дата ввода', value: (r) => formatEntryDateRu(r.entry_date) },
    { header: 'Начальный, м³', value: (r) => fmtNumExport(r.initial_m3) },
    { header: 'Текущий, м³', value: (r) => fmtNumExport(r.current_m3) },
    { header: 'Отгружено (жадный), м³', value: (r) => fmtNumExport(r.greedy_allocated_m3) },
    { header: 'Остаток, м³', value: (r) => fmtNumExport(r.greedy_remaining_m3) },
    { header: 'Пропорц., м³', value: (r) => fmtNumExport(r.proportional_allocated_m3) },
    {
      header: 'Превышение ёмкости',
      value: (r) => (r.proportional_exceeds_capacity ? 'да' : ''),
    },
    {
      header: 'В эксплуатации',
      value: (r) => (r.in_service ? 'да' : 'нет'),
    },
  ];
}

export function sandConsumerTableExportColumns(): ExcelColumn<SandLogisticsConsumerRow>[] {
  return [
    {
      header: 'Объект',
      value: (r) => r.name || subtypeDisplayLabel(r.subtype),
    },
    { header: 'Дата ввода', value: (r) => formatEntryDateRu(r.entry_date) },
    { header: 'Спрос, м³', value: (r) => fmtNumExport(r.demand_m3) },
    { header: 'км до карьера', value: (r) => fmtKmExport(r.distance_km) },
    { header: 'Карьер (жадный)', value: (r) => r.greedy_quarry_name ?? '' },
    { header: 'Выделено (жадный), м³', value: (r) => fmtNumExport(r.greedy_allocated_m3) },
    { header: 'Плечо возки (пропорц.)', value: (r) => haulLegsExportText(r) },
    {
      header: 'В эксплуатации',
      value: (r) => (r.in_service ? 'да' : 'нет'),
    },
  ];
}
