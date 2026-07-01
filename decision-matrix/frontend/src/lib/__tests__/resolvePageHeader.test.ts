import { describe, expect, it } from 'vitest';
import { resolvePageHeader } from '../resolvePageHeader';

describe('resolvePageHeader', () => {
  it('resolves dashboard route', () => {
    expect(resolvePageHeader('/')).toMatchObject({ title: 'Дашборд' });
  });

  it('resolves projects route', () => {
    expect(resolvePageHeader('/projects')).toMatchObject({ title: 'Проекты' });
  });

  it('returns null for project detail', () => {
    expect(resolvePageHeader('/projects/abc')).toBeNull();
  });

  it('resolves nested parameters route', () => {
    expect(resolvePageHeader('/parameters/rates')).toMatchObject({ title: 'Параметры' });
  });

  it('resolves nested data route', () => {
    expect(resolvePageHeader('/data/export')).toMatchObject({ title: 'Экспорт данных' });
    expect(resolvePageHeader('/data')).toMatchObject({ title: 'Данные' });
  });

  it('resolves map route with project suffix', () => {
    expect(
      resolvePageHeader('/map/abc12345-6789-4abc-def0-123456789abc'),
    ).toMatchObject({ title: 'Карта инфраструктуры' });
  });

  it('resolves admin route', () => {
    expect(resolvePageHeader('/admin/users')).toMatchObject({ title: 'Администрирование' });
  });
});
