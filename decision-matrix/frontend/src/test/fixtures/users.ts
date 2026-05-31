import type { UserRole } from '../../lib/permissions';

export type TestUser = {
  id: string;
  email: string;
  username: string;
  role: UserRole;
};

export const testAdmin: TestUser = {
  id: 'admin-1',
  email: 'admin@test.ru',
  username: 'admin',
  role: 'admin',
};

export const testAnalyst: TestUser = {
  id: 'analyst-1',
  email: 'analyst@test.ru',
  username: 'analyst',
  role: 'analyst',
};

export const testViewer: TestUser = {
  id: 'viewer-1',
  email: 'viewer@test.ru',
  username: 'viewer',
  role: 'viewer',
};
