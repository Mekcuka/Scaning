import { describe, expect, it } from 'vitest';

import type { AnalysisRow } from '../api';

import { buildMatrixRowsByPois } from '../matrixData';

import {

  getMatrixSectionOrder,

  matrixRowHasCardData,

  partitionMatrixRowsForCardGroups,

} from '../matrixCardView';

import type { MatrixRow, PoiColumnAnalysis } from '../matrixData';

import type { POI } from '../api';



const emptyColumn: PoiColumnAnalysis = { rows: [], total_cost_mln: null };



const analysisRow: MatrixRow = {

  label: 'Автодорога',

  section: 'Внешние линейные объекты',

  subtype: 'autoroad',

  paramType: 'external_linear',

  cells: [{ text: '—' }],

};



const fluidRow: MatrixRow = {

  label: 'Флюид',

  section: 'Точка интереса',

  cells: [{ text: 'Нефть' }],

};



const engineeringRow: MatrixRow = {

  label: 'Электроснабжение',

  section: 'Инженерные решения',

  engineering: true,

  engineeringKey: 'eng_power',

  cells: [{ text: 'Внешнее', badge: true }],

};



const injectionRow: MatrixRow = {

  label: 'ППД',

  section: 'Инженерные решения',

  engineering: true,

  engineeringKey: 'eng_injection',

  cells: [{ text: 'Централиз.', badge: true }],

};



const oilPrepRow: MatrixRow = {

  label: 'Подготовка нефти',

  section: 'Инженерные решения',

  engineering: true,

  engineeringKey: 'eng_oil_preparation',

  cells: [{ text: 'МКОС', badge: true }],

};



const gasPoi = { id: 'g1', name: 'Газовая', fluid_type: 'gas' } as POI;

const oilPoi = { id: 'o1', name: 'Нефтяная', fluid_type: 'oil' } as POI;



describe('getMatrixSectionOrder', () => {

  it('matches table row order with engineering before internal', () => {

    const pois = [{ id: 'p1', name: 'КП-1', fluid_type: 'oil', planned_production_volume: 100 }] as POI[];

    const { rows } = buildMatrixRowsByPois(pois, [emptyColumn]);

    const order = getMatrixSectionOrder(rows);



    expect(order.indexOf('Инженерные решения')).toBeLessThan(order.indexOf('Внутренние решения'));

    expect(order[0]).toBe('Точка интереса');

    expect(order).not.toContain('Итого');

  });

});



describe('matrixRowHasCardData', () => {

  it('returns false for analysis row without matching item', () => {

    expect(matrixRowHasCardData(analysisRow, emptyColumn)).toBe(false);

  });



  it('returns true for analysis row with item', () => {

    const column: PoiColumnAnalysis = {

      rows: [

        {

          subtype: 'autoroad',

          param_type: 'external_linear',

          status: 'not_required',

        } as AnalysisRow,

      ],

      total_cost_mln: null,

    };

    expect(matrixRowHasCardData(analysisRow, column)).toBe(true);

  });



  it('returns true for fluid and engineering rows', () => {

    expect(matrixRowHasCardData(fluidRow, emptyColumn)).toBe(true);

    expect(matrixRowHasCardData(engineeringRow, emptyColumn)).toBe(true);

  });



  it('returns false for PPD and oil prep when gas POI is selected', () => {

    expect(matrixRowHasCardData(injectionRow, emptyColumn, gasPoi)).toBe(false);

    expect(matrixRowHasCardData(oilPrepRow, emptyColumn, gasPoi)).toBe(false);

    expect(matrixRowHasCardData(engineeringRow, emptyColumn, gasPoi)).toBe(true);

  });



  it('returns true for PPD and oil prep when oil POI is selected', () => {

    expect(matrixRowHasCardData(injectionRow, emptyColumn, oilPoi)).toBe(true);

    expect(matrixRowHasCardData(oilPrepRow, emptyColumn, oilPoi)).toBe(true);

  });

});



describe('partitionMatrixRowsForCardGroups', () => {

  it('groups cards by section in table order', () => {

    const pois = [

      { id: 'p1', name: 'КП-1', fluid_type: 'oil', planned_production_volume: 100 },

    ] as POI[];

    const { rows } = buildMatrixRowsByPois(pois, [emptyColumn]);

    const poi = pois[0];

    const groups = partitionMatrixRowsForCardGroups(rows, emptyColumn, poi);



    const groupSections = groups.map((g) => g.section);
    const fullOrder = getMatrixSectionOrder(rows);
    for (let i = 1; i < groupSections.length; i++) {
      expect(fullOrder.indexOf(groupSections[i]!)).toBeGreaterThan(
        fullOrder.indexOf(groupSections[i - 1]!),
      );
    }

    expect(groups.find((g) => g.section === 'Точка интереса')?.rows.some((r) => r.label === 'Флюид')).toBe(

      true,

    );

    expect(

      groups.find((g) => g.section === 'Инженерные решения')?.rows.some((r) => r.label === 'Электроснабжение'),

    ).toBe(true);

    expect(groups.find((g) => g.section === 'Внешние линейные объекты')).toBeUndefined();

    expect(groups.every((g) => g.rows.every((r) => matrixRowHasCardData(r, emptyColumn, poi)))).toBe(true);

  });



  it('hides PPD and oil prep cards for gas POI in engineering section', () => {

    const pois = [

      { id: 'g1', name: 'Газ', fluid_type: 'gas', planned_production_volume: 50 },

    ] as POI[];

    const { rows } = buildMatrixRowsByPois(pois, [emptyColumn]);

    const poi = pois[0];

    const groups = partitionMatrixRowsForCardGroups(rows, emptyColumn, poi);

    const engineering = groups.find((g) => g.section === 'Инженерные решения');



    expect(engineering?.rows.some((r) => r.label === 'ППД')).toBe(false);

    expect(engineering?.rows.some((r) => r.label === 'Подготовка нефти')).toBe(false);

    expect(engineering?.rows.some((r) => r.label === 'Электроснабжение')).toBe(true);

  });



  it('includes analysis rows when column has matching items', () => {

    const column: PoiColumnAnalysis = {

      rows: [

        {

          subtype: 'autoroad',

          param_type: 'external_linear',

          status: 'within_limit',

          object_name: 'Дорога А',

        } as AnalysisRow,

      ],

      total_cost_mln: 10,

    };

    const groups = partitionMatrixRowsForCardGroups([analysisRow, fluidRow], column);

    const externalLinear = groups.find((g) => g.section === 'Внешние линейные объекты');

    const poiSection = groups.find((g) => g.section === 'Точка интереса');



    expect(externalLinear?.rows.map((r) => r.label)).toContain('Автодорога');

    expect(poiSection?.rows.map((r) => r.label)).toContain('Флюид');

  });



  it('omits empty sections', () => {

    const groups = partitionMatrixRowsForCardGroups([fluidRow], emptyColumn);

    expect(groups).toHaveLength(1);

    expect(groups[0]?.section).toBe('Точка интереса');

  });

});


