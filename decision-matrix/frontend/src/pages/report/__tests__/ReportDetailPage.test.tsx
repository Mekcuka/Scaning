import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { ReportDetailPage } from '../ReportDetailPage';
import { renderPage } from '../../../test/pages/renderPage';

vi.mock('../ReportEditorPage', () => ({
  ReportEditorPage: () => <div data-testid="mock-report-editor">editor</div>,
}));

describe('ReportDetailPage', () => {
  it('renders editor wrapper', () => {
    renderPage(<ReportDetailPage />);
    expect(screen.getByTestId('mock-report-editor')).toBeInTheDocument();
  });
});
