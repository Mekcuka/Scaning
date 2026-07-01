import { describe, expect, it } from 'vitest';

import { getQuickCommands } from '../toolLabels';

describe('getQuickCommands', () => {
  it('adds map contextual chip on /map', () => {
    const cmds = getQuickCommands({ pathname: '/map', role: 'analyst', hasProject: true });
    expect(cmds.some((c) => c.label === 'Объекты на карте')).toBe(true);
    expect(cmds[0]?.label).toBe('Справка: карта');
  });

  it('adds admin statistics chip on /admin', () => {
    const cmds = getQuickCommands({ pathname: '/admin/jobs', role: 'admin', hasProject: true });
    expect(cmds.some((c) => c.label === 'Статистика')).toBe(true);
    expect(cmds[0]?.label).toBe('Статистика');
  });

  it('dedupes contextual and base chips by label', () => {
    const cmds = getQuickCommands({
      pathname: '/parameters/rates',
      role: 'analyst',
      hasProject: true,
    });
    const tariffLabels = cmds.filter((c) => c.label === 'Тарифы');
    expect(tariffLabels).toHaveLength(1);
  });
});
