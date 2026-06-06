import { describe, expect, it } from 'vitest';
import { filterProjectsByQuery, filterProjectsOwnedByUser } from './projectDisplay';
import { makeProject } from '../test/fixtures/projects';

describe('filterProjectsOwnedByUser', () => {
  it('returns only projects owned by the user', () => {
    const projects = [
      makeProject({ id: 'p1', owner_user_id: 'u1' }),
      makeProject({ id: 'p2', owner_user_id: 'u2' }),
    ];
    expect(filterProjectsOwnedByUser(projects, 'u1')).toEqual([projects[0]]);
  });

  it('returns empty list when user id is missing', () => {
    expect(filterProjectsOwnedByUser([makeProject()], null)).toEqual([]);
  });
});

describe('filterProjectsByQuery', () => {
  it('does not throw when project name is null', () => {
    const projects = [makeProject({ name: null as unknown as string, description: 'desc' })];
    expect(() => filterProjectsByQuery(projects, 'desc')).not.toThrow();
    expect(filterProjectsByQuery(projects, 'desc')).toHaveLength(1);
  });

  it('returns all projects when query is empty', () => {
    const projects = [makeProject(), makeProject({ id: 'p2' })];
    expect(filterProjectsByQuery(projects, '   ')).toBe(projects);
  });

  it('matches by name case-insensitively', () => {
    const projects = [makeProject({ name: 'Восток' })];
    expect(filterProjectsByQuery(projects, 'вост')).toHaveLength(1);
  });
});
