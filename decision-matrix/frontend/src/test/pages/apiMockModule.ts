/** Factory for vi.mock('../lib/api') — use dynamic import inside the mock callback. */
export async function createApiMock(
  importOriginal: <T>() => Promise<T>,
  overrides: Record<string, unknown> = {},
) {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  const { createDefaultApiMocks } = await import('./mockApi');
  return {
    ...actual,
    api: {
      ...actual.api,
      ...createDefaultApiMocks(),
      ...overrides,
    },
  };
}
