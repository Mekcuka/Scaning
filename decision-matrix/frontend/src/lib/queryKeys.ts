export const queryKeys = {
  projects: ['projects'] as const,
  project: (id: string) => ['project', id] as const,
  infra: (projectId: string) => ['infra', projectId] as const,
  layers: (projectId: string) => ['layers', projectId] as const,
  pois: (projectId: string) => ['pois', projectId] as const,
  analysis: (projectId: string, poiId: string) => ['analysis', projectId, poiId] as const,
};
