import { describe, expect, it } from 'vitest';
import { projectPath, stripProjectPrefix, projectIdFromPathname, isGlobalAppPath } from './projectRoutes';

describe('projectRoutes', () => {
  it('builds project-scoped paths', () => {
    expect(projectPath('abc-123', '/map')).toBe('/abc-123/map');
    expect(projectPath('abc-123')).toBe('/abc-123');
  });

  it('strips project prefix from pathname', () => {
    expect(stripProjectPrefix('/abc-123/map')).toBe('/map');
    expect(stripProjectPrefix('/abc-123')).toBe('/');
    expect(stripProjectPrefix('/projects')).toBe('/projects');
    expect(stripProjectPrefix('/admin/users')).toBe('/admin/users');
  });

  it('extracts project id from pathname', () => {
    expect(projectIdFromPathname('/abc-123/map')).toBe('abc-123');
    expect(projectIdFromPathname('/projects')).toBeNull();
  });

  it('preserves legacy paths without project prefix', () => {
    expect(stripProjectPrefix('/parameters/rates')).toBe('/parameters/rates');
    expect(stripProjectPrefix('/data/export')).toBe('/data/export');
  });

  it('detects global paths', () => {
    expect(isGlobalAppPath('/projects')).toBe(true);
    expect(isGlobalAppPath('/abc/map')).toBe(false);
  });
});
