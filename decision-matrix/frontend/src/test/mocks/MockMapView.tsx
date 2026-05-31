import type { ComponentProps } from 'react';
import { MapView } from '../../components/MapView';

export type MockMapViewProps = ComponentProps<typeof MapView>;

/** Captures latest MapView props for MapPage integration tests. */
export function createMockMapView(
  capture: { mapProps: MockMapViewProps | null },
) {
  return function MockMapView(props: MockMapViewProps) {
    capture.mapProps = props;
    return <div data-testid="mock-map-view" />;
  };
}
