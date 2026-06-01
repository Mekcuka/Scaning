import { describe, expect, it } from 'vitest';
import {
  can,
  canAssignMap3dCustomModel,
  canDeleteProject,
  canSeeNav,
  canUploadMap3dCustomModel,
  normalizeRole,
} from './permissions';

describe('permissions', () => {
  it('normalizeRole falls back to viewer', () => {
    expect(normalizeRole(undefined)).toBe('viewer');
    expect(normalizeRole('unknown')).toBe('viewer');
  });

  it('can checks role capabilities', () => {
    expect(can('viewer', 'read')).toBe(true);
    expect(can('viewer', 'create_project')).toBe(false);
    expect(can('analyst', 'create_project')).toBe(true);
    expect(can('admin', 'manage_users')).toBe(true);
  });

  it('canDeleteProject allows admin and owner only', () => {
    expect(canDeleteProject('admin', 'u1', { owner_user_id: 'u2' })).toBe(true);
    expect(canDeleteProject('analyst', 'u1', { owner_user_id: 'u1' })).toBe(true);
    expect(canDeleteProject('analyst', 'u1', { owner_user_id: 'u2' })).toBe(false);
    expect(canDeleteProject('analyst', 'u1', { owner_user_id: null })).toBe(false);
    expect(canDeleteProject('analyst', null, { owner_user_id: 'u1' })).toBe(false);
  });

  it('canSeeNav respects NAV_VISIBILITY', () => {
    expect(canSeeNav('viewer', '/import')).toBe(false);
    expect(canSeeNav('data_manager', '/import')).toBe(true);
    expect(canSeeNav('admin', '/import-3d')).toBe(true);
    expect(canSeeNav('viewer', '/import-3d')).toBe(false);
    expect(canSeeNav('analyst', '/import-3d')).toBe(false);
    expect(
      canSeeNav('analyst', '/import-3d', {
        userId: 'u1',
        activeProject: { owner_user_id: 'u1' },
      }),
    ).toBe(true);
    expect(canUploadMap3dCustomModel('admin')).toBe(true);
    expect(canUploadMap3dCustomModel('analyst')).toBe(false);
    expect(
      canAssignMap3dCustomModel('analyst', 'u1', { owner_user_id: 'u1' }),
    ).toBe(true);
    expect(canSeeNav('admin', '/admin')).toBe(true);
    expect(canSeeNav('viewer', '/admin')).toBe(false);
  });
});
