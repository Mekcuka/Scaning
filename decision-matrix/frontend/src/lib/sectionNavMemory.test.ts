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

  it('remembers logistics schematic sub-route', () => {
    rememberSectionFromPath('/logistics/schematic');
    expect(getSavedSectionPath('logistics')).toBe('/logistics/schematic');
  });

  it('migrates legacy flows logistics path', () => {
    sessionStorage.setItem('dm-nav-last-section:flows', '/flows/logistics');
    expect(getLastSectionPath('flows')).toBe('/flows/technology');
    sessionStorage.setItem('dm-nav-last-section:logistics', '/flows/logistics');
    expect(getLastSectionPath('logistics')).toBe('/logistics/schematic');
  });

  it('remembers data export sub-route', () => {
    rememberSectionFromPath('/data/export');
    expect(getLastSectionPath('data')).toBe('/data/export');
  });
});
