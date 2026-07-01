import { describe, expect, it } from 'vitest';

import { formatDemApiError } from '../demApiErrors';
import { formatApiError } from '../api/client';

describe('formatDemApiError', () => {
  it('translates dem_api_not_configured', () => {
    expect(formatDemApiError('dem_api_not_configured')).toContain('ЦМР недоступен');
    expect(formatDemApiError('dem_api_not_configured')).toContain('OPENTOPOGRAPHY_API_KEY');
  });

  it('translates dem codes embedded in HTTPException text', () => {
    expect(formatDemApiError('503: dem_api_not_configured')).toContain('ЦМР недоступен');
  });

  it('translates dem_api_key_invalid_format', () => {
    expect(formatDemApiError('dem_api_key_invalid_format')).toContain('32-символьная');
  });

  it('translates dem_rate_limit_exceeded', () => {
    expect(formatDemApiError('dem_rate_limit_exceeded')).toContain('лимит');
  });
});

describe('formatApiError dem_* integration', () => {
  it('routes dem_api_not_configured through formatDemApiError', () => {
    const msg = formatApiError('dem_api_not_configured', 'fallback');
    expect(msg).toContain('ЦМР недоступен');
    expect(msg).not.toBe('dem_api_not_configured');
  });
});
