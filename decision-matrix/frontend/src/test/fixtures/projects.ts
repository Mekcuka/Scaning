import type { Project } from '../../lib/api';

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Test project',
    description: null,
    status: 'draft',
    visibility: 'private',
    poi_count: 0,
    owner_user_id: 'u1',
    owner_name: 'User',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

export const sampleProjects: Project[] = [
  makeProject({ id: 'p1', name: 'Alpha' }),
  makeProject({ id: 'p2', name: 'Beta' }),
];
