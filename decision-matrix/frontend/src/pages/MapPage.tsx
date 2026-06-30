import { Card } from 'antd';
import { DevPortBanner } from '../components/DevPortBanner';
import { usePageHeader } from '../components/layout/pageHeaderContext';
import { useMapPageOrchestrator } from '../hooks/useMapPageOrchestrator';
import { MapPageCanvas } from './map/MapPageCanvas';
import { MapPageFooter } from './map/MapPageFooter';
import { MapPageAnalyzeActions } from './map/MapPageHeader';
import { MapPageLayersSidebar } from './map/MapPageLayersSidebar';
import { MapPageModals } from './map/MapPageModals';
import { MapPageSidePanels } from './map/MapPageSidePanels';
import { MapPageToolbar } from './map/MapPageToolbar';

export function MapPage() {
  const { autoroadConfirmModal, lineSplitConfirmModal, mapCanvasRef, sections } =
    useMapPageOrchestrator();

  usePageHeader({ title: 'Карта инфраструктуры' }, []);

  return (
    <div className="map-page flex flex-1 flex-col min-h-0 overflow-hidden">
      <div className="map-page-actions shrink-0 flex justify-end mb-3">
        <MapPageAnalyzeActions {...sections.header} />
      </div>

      <DevPortBanner />

      <Card
        className="card--flush map-page-card flex flex-1 flex-col min-h-0 overflow-hidden"
        styles={{ body: { padding: 0, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } }}
      >
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
      </Card>

      {autoroadConfirmModal}
      {lineSplitConfirmModal}

      <MapPageModals {...sections.modals} />
    </div>
  );
}
