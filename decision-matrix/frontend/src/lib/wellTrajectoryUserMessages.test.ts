import { describe, expect, it } from 'vitest';
import { translateWellTrajectoryUserMessage } from './wellTrajectoryUserMessages';

describe('translateWellTrajectoryUserMessage', () => {
  it('translates exact English API messages', () => {
    expect(translateWellTrajectoryUserMessage('No trajectories stored')).toBe(
      'Нет сохранённых траекторий',
    );
  });

  it('translates pattern warnings', () => {
    expect(
      translateWellTrajectoryUserMessage('2 of 3 wells have no bottomhole target'),
    ).toBe('2 из 3 скважин без цели (забоя)');
  });

  it('passes through already Russian text', () => {
    const ru = 'Скв.2: пятка (heel) ГС без парного toe';
    expect(translateWellTrajectoryUserMessage(ru)).toBe(ru);
  });
});
