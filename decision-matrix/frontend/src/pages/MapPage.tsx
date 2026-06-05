import { DevPortBanner } from '../components/DevPortBanner';
import { useMapPageOrchestrator } from '../hooks/useMapPageOrchestrator';
import { MapPageCanvas } from './map/MapPageCanvas';
import { MapPageEmptyProject } from './map/MapPageEmptyProject';
import { MapPageFooter } from './map/MapPageFooter';
import { MapPageHeader } from './map/MapPageHeader';
import { MapPageLayersSidebar } from './map/MapPageLayersSidebar';
import { MapPageModals } from './map/MapPageModals';
import { MapPageSidePanels } from './map/MapPageSidePanels';
import { MapPageToolbar } from './map/MapPageToolbar';

export function MapPage() {
  const { projectId, autoroadConfirmModal, mapCanvasRef, sections } = useMapPageOrchestrator();

  return (
    <div className="map-page flex flex-1 flex-col min-h-0 overflow-hidden">
      <MapPageHeader {...sections.header} />

      <DevPortBanner />

      {!projectId && <MapPageEmptyProject />}

      <div className="card map-page-card flex flex-1 flex-col min-h-0 overflow-hidden">
        <MapPageToolbar {...sections.toolbar} />

        <div className="map-layout">
          <MapPageLayersSidebar {...sections.layersSidebar} />

          <div className="map-main-column">
            <div className="map-canvas-wrap" ref={mapCanvasRef}>
              <MapPageCanvas {...sections.canvas} />
              <MapPageSidePanels {...sections.sidePanels} />
            </div>

            <MapPageFooter {...sections.footer} />
          </div>
        </div>
      </div>

      {autoroadConfirmModal}

      <MapPageModals {...sections.modals} />
    </div>
  );
}
