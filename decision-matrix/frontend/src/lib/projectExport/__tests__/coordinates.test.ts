import { describe, expect, it } from 'vitest';
import type { InfraObject } from '../../api';
import {
  buildAllCoordinateRows,
  buildAllCoordinatesCsv,
  buildPointCoordinateRows,
  buildPointCoordinatesCsv,
  filterPointObjects,
} from '../coordinates';

const pointObj: InfraObject = {
  id: 'p1',
  layer_id: 'l1',
  name: 'Node-1',
  subtype: 'node',
  category: 'point',
  lon: 38.06,
  lat: 56.02,
};

const lineObj: InfraObject = {
  id: 'l1',
  layer_id: 'l1',
  name: 'Road-1',
  subtype: 'autoroad',
  category: 'line',
  lon: 38.06,
  lat: 56.02,
  end_lon: 38.07,
  end_lat: 56.03,
  coordinates: [
    [38.06, 56.02],
    [38.07, 56.03],
  ],
};

describe('filterPointObjects', () => {
  it('keeps point subtypes and excludes lines', () => {
    const filtered = filterPointObjects([pointObj, lineObj]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('p1');
  });
});

describe('buildPointCoordinateRows', () => {
  it('maps point objects to coordinate rows', () => {
    const rows = buildPointCoordinateRows([pointObj, lineObj]);
    expect(rows).toEqual([
      {
        id: 'p1',
        name: 'Node-1',
        type: 'node',
        lat: 56.02,
        lon: 38.06,
      },
    ]);
  });
});

describe('buildPointCoordinatesCsv', () => {
  it('uses import-compatible header and point row shape', () => {
    const csv = buildPointCoordinatesCsv(buildPointCoordinateRows([pointObj]));
    expect(csv.split('\n')[0]).toBe('name,type,lat,lon,start_lat,start_lon,end_lat,end_lon');
    expect(csv.split('\n')[1]).toBe('Node-1,node,56.02,38.06,,,,');
  });
});

describe('buildAllCoordinateRows', () => {
  it('includes point and line rows with extended columns', () => {
    const rows = buildAllCoordinateRows([pointObj, lineObj]);
    expect(rows[0]).toMatchObject({
      id: 'p1',
      lat: 56.02,
      lon: 38.06,
      coordinates: '',
    });
    expect(rows[1]).toMatchObject({
      id: 'l1',
      lat: '',
      lon: '',
      start_lat: 56.02,
      start_lon: 38.06,
      end_lat: 56.03,
      end_lon: 38.07,
      coordinates: JSON.stringify(lineObj.coordinates),
    });
  });
});

describe('buildAllCoordinatesCsv', () => {
  it('includes coordinates column for lines', () => {
    const csv = buildAllCoordinatesCsv(buildAllCoordinateRows([lineObj]));
    expect(csv.split('\n')[0]).toContain('coordinates');
    expect(csv.split('\n')[1]).toContain('[[38.06,56.02],[38.07,56.03]]');
  });
});
