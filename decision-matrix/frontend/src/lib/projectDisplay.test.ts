import { describe, expect, it } from 'vitest';
import { filterProjectsByQuery } from './projectDisplay';
import { makeProject } from '../test/fixtures/projects';

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
