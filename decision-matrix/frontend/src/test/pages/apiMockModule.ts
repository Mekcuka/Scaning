/** Wire DIP default ports to the same mocked methods as `api` (Phase 4). */
function createDefaultPorts(mockedApi: Record<string, unknown>) {
  return {
    defaultProjectsListApi: {
      projects: mockedApi.projects,
    },
    defaultProjectsDataApi: {
      getPois: mockedApi.getPois,
    },
    defaultMapDataApi: {
      getInfraObjects: mockedApi.getInfraObjects,
      getLayers: mockedApi.getLayers,
    },
    defaultMapInfraApi: {
      getInfraObjects: mockedApi.getInfraObjects,
    },
  };
}

/** Factory for vi.mock('../lib/api') — use dynamic import inside the mock callback. */
export async function createApiMock(
  importOriginal: <T>() => Promise<T>,
  overrides: Record<string, unknown> = {},
) {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  const { createDefaultApiMocks } = await import('./mockApi');
  const mockedApi = {
    ...actual.api,
    ...createDefaultApiMocks(),
    ...overrides,
  };
  return {
    ...actual,
    api: mockedApi,
    ...createDefaultPorts(mockedApi),
  };
}
