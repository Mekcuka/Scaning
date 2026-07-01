import { describe, expect, it } from 'vitest';
import { lineDraftFinishCoordinates } from '../mapLineDraftFinish';

describe('lineDraftFinishCoordinates', () => {
  it('returns undefined when preview is null', () => {
    expect(lineDraftFinishCoordinates(null)).toBeUndefined();
    expect(lineDraftFinishCoordinates(undefined)).toBeUndefined();
  });

  it('maps preview tuple to lon/lat', () => {
    expect(lineDraftFinishCoordinates([37.6, 55.75])).toEqual({ lon: 37.6, lat: 55.75 });
  });
});
