import { buildCanvasSection } from './buildCanvasSection';
import { buildFooterSection } from './buildFooterSection';
import { buildHeaderSection } from './buildHeaderSection';
import { buildLayersSidebarSection } from './buildLayersSidebarSection';
import { buildModalsSection } from './buildModalsSection';
import { buildSidePanelsSection } from './buildSidePanelsSection';
import { buildToolbarSection } from './buildToolbarSection';
import type { BuildMapPageSectionsParams, MapPageSections } from './types';

export type { BuildMapPageSectionsParams, MapPageSections } from './types';

export function buildMapPageSections(params: BuildMapPageSectionsParams): MapPageSections {
  return {
    header: buildHeaderSection(params),
    toolbar: buildToolbarSection(params),
    layersSidebar: buildLayersSidebarSection(params),
    canvas: buildCanvasSection(params),
    sidePanels: buildSidePanelsSection(params),
    footer: buildFooterSection(params),
    modals: buildModalsSection(params),
  };
}
