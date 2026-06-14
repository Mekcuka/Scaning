import { beforeEach, describe, expect, it } from 'vitest';
import {
  getLastSectionPath,
  getSavedSectionPath,
  navLinkTargetForSection,
  rememberSectionFromPath,
} from './sectionNavMemory';

describe('sectionNavMemory', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('returns defaults when nothing saved', () => {
    expect(getLastSectionPath('parameters')).toBe('/parameters/capacity');
    expect(getLastSectionPath('admin')).toBe('/admin/users');
  });

  it('remembers and restores parameters sub-route', () => {
    rememberSectionFromPath('/parameters/rates');
    expect(getLastSectionPath('parameters')).toBe('/parameters/rates');
    expect(navLinkTargetForSection('parameters')).toBe('/parameters/rates');
  });

  it('ignores section index path', () => {
    rememberSectionFromPath('/parameters');
    expect(getSavedSectionPath('parameters')).toBeNull();
    expect(getLastSectionPath('parameters')).toBe('/parameters/capacity');
  });

  it('ignores unknown paths', () => {
    rememberSectionFromPath('/parameters/unknown');
    expect(getLastSectionPath('parameters')).toBe('/parameters/capacity');
  });

  it('remembers flows logistics', () => {
    rememberSectionFromPath('/flows/logistics');
    expect(getSavedSectionPath('flows')).toBe('/flows/logistics');
  });

  it('remembers data export sub-route', () => {
    rememberSectionFromPath('/data/export');
    expect(getLastSectionPath('data')).toBe('/data/export');
  });
});
