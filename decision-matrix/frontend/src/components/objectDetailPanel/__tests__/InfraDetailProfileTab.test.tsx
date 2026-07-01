import { render, screen } from '@testing-library/react';

import userEvent from '@testing-library/user-event';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { describe, expect, it, vi } from 'vitest';



import { InfraDetailProfileTab } from '../InfraDetailProfileTab';

import type { InfraObject } from '../../../lib/api';



vi.mock('../../../hooks/useLineElevationProfileCompute', () => ({

  useLineElevationProfileCompute: () => ({ compute: vi.fn(), computePending: false }),

  useLineElevationProfileQuery: () => ({ data: null, isLoading: false }),

}));



function renderTab(object: InfraObject) {

  const client = new QueryClient();

  return render(

    <QueryClientProvider client={client}>

      <InfraDetailProfileTab

        projectId="proj-1"

        infraObject={object}

        readOnly={false}

        lineProfileStepM="100"

        setLineProfileStepM={() => {}}

      />

    </QueryClientProvider>,

  );

}



const profileObject: InfraObject = {

  id: 'line-1',

  layer_id: 'layer-1',

  name: 'Дорога',

  subtype: 'autoroad',

  lon: 37.6,

  lat: 55.75,

  properties: {

    line_elevation_profile_json: {

      step_m: 100,

      computed_at: '2026-07-01T12:00:00Z',

      dem_source: 'opentopography:COP30',

      total_length_m: 200,

      points: [

        { chainage_m: 0, lon: 37.6, lat: 55.75, elevation_m: 100 },

        { chainage_m: 100, lon: 37.601, lat: 55.75, elevation_m: 101 },

      ],

    },

  },

};



describe('InfraDetailProfileTab', () => {

  it('shows empty hint when profile is missing', () => {

    const object: InfraObject = {

      id: 'line-1',

      layer_id: 'layer-1',

      name: 'Дорога',

      subtype: 'autoroad',

      lon: 37.6,

      lat: 55.75,

      properties: {},

    };

    renderTab(object);

    expect(screen.getByText('Профиль не рассчитан')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Рассчитать профиль' })).toBeInTheDocument();

    expect(screen.queryByText('Таблица')).not.toBeInTheDocument();

    expect(screen.queryByText('График')).not.toBeInTheDocument();

  });



  it('renders table by default when profile exists in properties', () => {

    renderTab(profileObject);

    expect(screen.getByText('0+000')).toBeInTheDocument();

    expect(screen.getByText('1+000')).toBeInTheDocument();

    expect(screen.getByText('2 точки')).toBeInTheDocument();

    expect(screen.getByText('200 м')).toBeInTheDocument();

    expect(screen.getByText('OpenTopography COP30')).toBeInTheDocument();

    expect(screen.getByText('Таблица')).toBeInTheDocument();

    expect(screen.getByText('График')).toBeInTheDocument();

    expect(screen.queryByText(/Синтетический ЦМР — результат/)).not.toBeInTheDocument();

  });



  it('shows fractional chainage on last profile point', () => {

    renderTab({

      ...profileObject,

      properties: {

        line_elevation_profile_json: {

          step_m: 100,

          computed_at: '2026-07-01T12:00:00Z',

          dem_source: 'opentopography:COP30',

          total_length_m: 1437.3,

          points: [

            { chainage_m: 0, lon: 37.6, lat: 55.75, elevation_m: 100 },

            { chainage_m: 1400, lon: 37.61, lat: 55.75, elevation_m: 101 },

            { chainage_m: 1437.3, lon: 37.611, lat: 55.75, elevation_m: 102 },

          ],

        },

      },

    });

    expect(screen.getByText('14+000')).toBeInTheDocument();

    expect(screen.getByText('14+37,3')).toBeInTheDocument();

    expect(screen.getAllByText(/1\s437,3/).length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText(/1\s400/)).toBeInTheDocument();

    expect(screen.getByText(/1\s437,3 м/)).toBeInTheDocument();

  });



  it('shows synthetic DEM banner for dev flat source', () => {

    renderTab({

      ...profileObject,

      properties: {

        line_elevation_profile_json: {

          ...profileObject.properties!.line_elevation_profile_json,

          dem_source: 'synthetic:dev_flat',

        },

      },

    });

    expect(screen.getByText('Синтетический ЦМР (dev)')).toBeInTheDocument();

    expect(screen.getByText(/Синтетический ЦМР — результат только для разработки/)).toBeInTheDocument();

  });



  it('switches to chart mode when График is selected', async () => {

    const user = userEvent.setup();

    renderTab(profileObject);



    await user.click(screen.getByText('График'));



    expect(screen.getByTestId('line-profile-chart')).toBeInTheDocument();

    expect(screen.queryByText('0+000')).not.toBeInTheDocument();

  });

});
