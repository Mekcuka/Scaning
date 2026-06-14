import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PadPlacementPanel } from './PadPlacementPanel';
import { DEFAULT_PAD_PLACEMENT_PARAMS } from '../../lib/padPlacementTypes';

const baseProps = {
  items: [],
  visibleEligibleCount: 0,
  params: DEFAULT_PAD_PLACEMENT_PARAMS,
  onParamsChange: vi.fn(),
  subtype: 'oil_pad' as const,
  onSubtypeChange: vi.fn(),
  selectedVariantIndex: 0,
  onSelectVariant: vi.fn(),
  onClose: vi.fn(),
  onClear: vi.fn(),
  onRemoveItem: vi.fn(),
  onAddVisible: vi.fn(),
  onCompute: vi.fn(),
  onApply: vi.fn(),
  canCompute: true,
  computePending: false,
  applyPending: false,
};

describe('PadPlacementPanel apply button', () => {
  it('enables apply for a valid computed variant', () => {
    render(
      <PadPlacementPanel
        {...baseProps}
        computeResult={{
          request_id: 'req-1',
          logical_well_count: 1,
          partitions_evaluated: 1,
          variants: [
            {
              variant_index: 0,
              pad_count: 1,
              sum_md_m: 1200,
              score_warnings: [],
              invalid: false,
              min_sf: null,
            },
          ],
          warnings: [],
          computed_at: '2026-01-01T00:00:00Z',
        }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Применить' })).toBeEnabled();
  });

  it('keeps apply disabled for invalid variant', () => {
    render(
      <PadPlacementPanel
        {...baseProps}
        computeResult={{
          request_id: 'req-1',
          logical_well_count: 1,
          partitions_evaluated: 1,
          variants: [
            {
              variant_index: 0,
              pad_count: 1,
              sum_md_m: 1200,
              score_warnings: ['Not all wells have calculated trajectories'],
              invalid: true,
              min_sf: null,
            },
          ],
          warnings: [],
          computed_at: '2026-01-01T00:00:00Z',
        }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Применить' })).toBeDisabled();
  });

  it('calls onApply when enabled', async () => {
    const onApply = vi.fn();
    render(
      <PadPlacementPanel
        {...baseProps}
        onApply={onApply}
        computeResult={{
          request_id: 'req-1',
          logical_well_count: 1,
          partitions_evaluated: 1,
          variants: [
            {
              variant_index: 0,
              pad_count: 1,
              sum_md_m: 1200,
              score_warnings: [],
              invalid: false,
              min_sf: null,
            },
          ],
          warnings: [],
          computed_at: '2026-01-01T00:00:00Z',
        }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Применить' }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });
});
