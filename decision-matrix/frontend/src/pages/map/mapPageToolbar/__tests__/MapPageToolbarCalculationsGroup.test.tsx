import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MapPageToolbarCalculationsGroup } from '../MapPageToolbarCalculationsGroup';

function renderGroup(overrides: Partial<React.ComponentProps<typeof MapPageToolbarCalculationsGroup>> = {}) {
  const onLineProfileCompute = vi.fn();
  render(
    <MapPageToolbarCalculationsGroup
      projectId="proj-1"
      poisCount={1}
      selectedPoiId={null}
      selectedPoiName={null}
      canWriteProject
      canWriteInfra
      analyzePending={false}
      onAnalyzeAll={vi.fn()}
      onAnalyzeSelected={vi.fn()}
      drawMode="select"
      onDrawModeChange={vi.fn()}
      onResetDrawingMenus={vi.fn()}
      projectJobBusy={false}
      mapIn3d={false}
      onLineProfileCompute={onLineProfileCompute}
      {...overrides}
    />,
  );
  return { onLineProfileCompute };
}

describe('MapPageToolbarCalculationsGroup', () => {
  it('calls onLineProfileCompute when menu item is clicked', async () => {
    const { onLineProfileCompute } = renderGroup();

    await userEvent.click(screen.getByRole('button', { name: 'Расчёт' }));
    await userEvent.click(screen.getByRole('button', { name: 'Рассчитать профиль' }));

    expect(onLineProfileCompute).toHaveBeenCalledTimes(1);
  });

  it('does not render profile action without handler', async () => {
    renderGroup({ onLineProfileCompute: undefined });

    await userEvent.click(screen.getByRole('button', { name: 'Расчёт' }));

    expect(screen.queryByRole('button', { name: 'Рассчитать профиль' })).not.toBeInTheDocument();
  });

  it('disables profile action in 3D mode', async () => {
    renderGroup({ mapIn3d: true });

    await userEvent.click(screen.getByRole('button', { name: 'Расчёт' }));

    expect(screen.getByRole('button', { name: 'Рассчитать профиль' })).toBeDisabled();
  });
});
