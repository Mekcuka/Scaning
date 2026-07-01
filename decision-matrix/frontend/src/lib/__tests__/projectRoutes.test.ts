import { describe, expect, it } from 'vitest';
import {
  isGlobalAppPath,
  isProjectIdSegment,
  legacyPrefixToSuffixPath,
  projectIdFromPathname,
  projectPath,
  stripProjectPrefix,
} from '../projectRoutes';

const PID = 'abc12345-0000-4000-8000-000000000001';

describe('projectRoutes', () => {
  it('detects UUID project id segments', () => {
    expect(isProjectIdSegment(PID)).toBe(true);
    expect(isProjectIdSegment('map')).toBe(false);
  });

  it('builds project-suffix paths', () => {
    expect(projectPath(PID, '/map')).toBe(`/map/${PID}`);
    expect(projectPath(PID, '/parameters/rates')).toBe(`/parameters/rates/${PID}`);
    expect(projectPath(PID)).toBe(`/dashboard/${PID}`);
    expect(projectPath(PID, '/')).toBe(`/dashboard/${PID}`);
  });

  it('strips project suffix from pathname', () => {
    expect(stripProjectPrefix(`/map/${PID}`)).toBe('/map');
    expect(stripProjectPrefix(`/parameters/rates/${PID}`)).toBe('/parameters/rates');
    expect(stripProjectPrefix(`/dashboard/${PID}`)).toBe('/');
    expect(stripProjectPrefix(`/report/new/${PID}`)).toBe('/report/new');
    expect(stripProjectPrefix(`/report/${PID}`)).toBe('/report');
  });

  it('strips legacy project prefix from pathname', () => {
    expect(stripProjectPrefix(`/${PID}/map`)).toBe('/map');
    expect(stripProjectPrefix(`/${PID}`)).toBe('/');
    expect(stripProjectPrefix(`/${PID}/parameters/rates`)).toBe('/parameters/rates');
  });

  it('extracts project id from suffix and legacy prefix', () => {
    expect(projectIdFromPathname(`/map/${PID}`)).toBe(PID);
    expect(projectIdFromPathname(`/${PID}/map`)).toBe(PID);
    expect(projectIdFromPathname('/projects')).toBeNull();
    expect(projectIdFromPathname('/parameters/rates')).toBeNull();
  });

  it('converts legacy prefix paths to suffix paths', () => {
    expect(legacyPrefixToSuffixPath(`/${PID}/map`)).toBe(`/map/${PID}`);
    expect(legacyPrefixToSuffixPath(`/${PID}/parameters/rates`)).toBe(`/parameters/rates/${PID}`);
    expect(legacyPrefixToSuffixPath(`/${PID}`)).toBe(`/dashboard/${PID}`);
    expect(legacyPrefixToSuffixPath('/map')).toBeNull();
  });

  it('preserves bare legacy paths without project id', () => {
    expect(stripProjectPrefix('/parameters/rates')).toBe('/parameters/rates');
    expect(stripProjectPrefix('/data/export')).toBe('/data/export');
  });

  it('detects global paths', () => {
    expect(isGlobalAppPath('/projects')).toBe(true);
    expect(isGlobalAppPath(`/map/${PID}`)).toBe(false);
  });
});
