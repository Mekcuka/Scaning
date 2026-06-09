import type { InfraObject } from '../api';
import { POINT_SUBTYPES } from '../api/infrastructureSubtypesManifest';
import { downloadExcel, type ExcelColumn } from '../exportExcel';
import { getLineCoordinates, isLineSubtype } from '../infraGeometry';
import { downloadBlob } from '../mapSnapshot';

const POINT_SUBTYPE_SET = new Set<string>(POINT_SUBTYPES);

export type PointCoordinateRow = {
  id: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
};

export type AllCoordinateRow = {
  id: string;
  name: string;
  type: string;
  lat: number | '';
  lon: number | '';
  start_lat: number | '';
  start_lon: number | '';
  end_lat: number | '';
  end_lon: number | '';
  coordinates: string;
};

export function filterPointObjects(objects: InfraObject[]): InfraObject[] {
  return objects.filter((obj) => POINT_SUBTYPE_SET.has(obj.subtype) && !isLineSubtype(obj.subtype));
}

export function buildPointCoordinateRows(objects: InfraObject[]): PointCoordinateRow[] {
  return filterPointObjects(objects).map((obj) => ({
    id: obj.id,
    name: obj.name,
    type: obj.subtype,
    lat: obj.lat,
    lon: obj.lon,
  }));
}

export function buildAllCoordinateRows(objects: InfraObject[]): AllCoordinateRow[] {
  return objects.map((obj) => {
    if (isLineSubtype(obj.subtype)) {
      const coords = getLineCoordinates(obj);
      const start = coords?.[0];
      const end = coords?.[coords.length - 1];
      return {
        id: obj.id,
        name: obj.name,
        type: obj.subtype,
        lat: '',
        lon: '',
        start_lat: start?.[1] ?? obj.lat,
        start_lon: start?.[0] ?? obj.lon,
        end_lat: end?.[1] ?? obj.end_lat ?? '',
        end_lon: end?.[0] ?? obj.end_lon ?? '',
        coordinates: coords ? JSON.stringify(coords) : '',
      };
    }

    return {
      id: obj.id,
      name: obj.name,
      type: obj.subtype,
      lat: obj.lat,
      lon: obj.lon,
      start_lat: '',
      start_lon: '',
      end_lat: '',
      end_lon: '',
      coordinates: '',
    };
  });
}

function csvCell(value: string | number): string {
  const raw = String(value);
  if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function csvRow(values: Array<string | number>): string {
  return values.map(csvCell).join(',');
}

export function buildPointCoordinatesCsv(rows: PointCoordinateRow[]): string {
  const header = 'name,type,lat,lon,start_lat,start_lon,end_lat,end_lon';
  const lines = rows.map((row) =>
    csvRow([row.name, row.type, row.lat, row.lon, '', '', '', '']),
  );
  return [header, ...lines].join('\n');
}

export function buildAllCoordinatesCsv(rows: AllCoordinateRow[]): string {
  const header = 'id,name,type,lat,lon,start_lat,start_lon,end_lat,end_lon,coordinates';
  const lines = rows.map((row) =>
    csvRow([
      row.id,
      row.name,
      row.type,
      row.lat,
      row.lon,
      row.start_lat,
      row.start_lon,
      row.end_lat,
      row.end_lon,
      row.coordinates,
    ]),
  );
  return [header, ...lines].join('\n');
}

const POINT_EXCEL_COLUMNS: ExcelColumn<PointCoordinateRow>[] = [
  { header: 'id', value: (row) => row.id },
  { header: 'name', value: (row) => row.name },
  { header: 'type', value: (row) => row.type },
  { header: 'lat', value: (row) => row.lat },
  { header: 'lon', value: (row) => row.lon },
];

const ALL_EXCEL_COLUMNS: ExcelColumn<AllCoordinateRow>[] = [
  { header: 'id', value: (row) => row.id },
  { header: 'name', value: (row) => row.name },
  { header: 'type', value: (row) => row.type },
  { header: 'lat', value: (row) => row.lat },
  { header: 'lon', value: (row) => row.lon },
  { header: 'start_lat', value: (row) => row.start_lat },
  { header: 'start_lon', value: (row) => row.start_lon },
  { header: 'end_lat', value: (row) => row.end_lat },
  { header: 'end_lon', value: (row) => row.end_lon },
  { header: 'coordinates', value: (row) => row.coordinates },
];

export function downloadPointCoordinatesExcel(filename: string, objects: InfraObject[]): void {
  downloadExcel(filename, 'Точечные объекты', POINT_EXCEL_COLUMNS, buildPointCoordinateRows(objects));
}

export function downloadPointCoordinatesCsv(filename: string, objects: InfraObject[]): void {
  const csv = buildPointCoordinatesCsv(buildPointCoordinateRows(objects));
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

export function downloadAllCoordinatesExcel(filename: string, objects: InfraObject[]): void {
  downloadExcel(filename, 'Все объекты', ALL_EXCEL_COLUMNS, buildAllCoordinateRows(objects));
}

export function downloadAllCoordinatesCsv(filename: string, objects: InfraObject[]): void {
  const csv = buildAllCoordinatesCsv(buildAllCoordinateRows(objects));
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}
