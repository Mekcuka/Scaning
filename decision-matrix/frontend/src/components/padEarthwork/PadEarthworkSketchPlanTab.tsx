import type { PadEarthworkSketchPlanTabProps } from './padEarthworkSketchPlanTabTypes';
export type { PadEarthworkSketchPlanTabProps } from './padEarthworkSketchPlanTabTypes';
import PlanPolygonEditor from './PlanPolygonEditor';
import { PlanRectangleEditor } from './PlanRectangleEditor';
import { PadEarthworkSketchPlanSidebar } from './PadEarthworkSketchPlanSidebar';
import { PadEarthworkSketchPlanToolbar } from './PadEarthworkSketchPlanToolbar';

export function PadEarthworkSketchPlanTab(props: PadEarthworkSketchPlanTabProps) {
  const {
    shapeMode,
    showGenerator,
    readOnly,
    rectangleSketch,
    polygonSketch,
    updateSketch,
    rectTool,
    polygonTool,
    snapEnabled,
    lockAspect,
    zoom,
    setZoom,
    viewPan,
    setViewPan,
    fitViewNonce,
    envelopeParams,
    showDemOverlay,
    demPreviewData,
    demPreviewLoading,
    wellsLocal,
  } = props;

  return (
    <>
      <PadEarthworkSketchPlanToolbar {...props} />

      <div
        className={`pad-earthwork-sketch-modal__layout${
          shapeMode === 'generator' ? ' pad-earthwork-sketch-modal__layout--generator' : ''
        }`}
      >
        <div className="pad-earthwork-sketch-modal__canvas-col">
          {shapeMode === 'rectangle' ? (
            <PlanRectangleEditor
              sketch={rectangleSketch}
              onChange={updateSketch}
              tool={rectTool}
              snapEnabled={snapEnabled}
              lockAspect={lockAspect}
              zoom={zoom}
              onZoomChange={setZoom}
              viewPan={viewPan}
              onViewPanChange={setViewPan}
              fitViewNonce={fitViewNonce}
              readOnly={readOnly}
              envelope={envelopeParams}
              showEdgeLengths={props.showEdgeLengths}
              showDemOverlay={showDemOverlay}
              demPreview={demPreviewData}
              demPreviewLoading={demPreviewLoading}
            />
          ) : (
            <PlanPolygonEditor
              sketch={polygonSketch}
              onChange={updateSketch}
              tool={polygonTool}
              snapEnabled={snapEnabled}
              zoom={zoom}
              onZoomChange={setZoom}
              viewPan={viewPan}
              onViewPanChange={setViewPan}
              fitViewNonce={fitViewNonce}
              readOnly={readOnly || shapeMode === 'generator'}
              envelope={envelopeParams}
              showEdgeLengths={props.showEdgeLengths}
              wellsLocal={showGenerator ? wellsLocal : []}
              showDemOverlay={showDemOverlay}
              demPreview={demPreviewData}
              demPreviewLoading={demPreviewLoading}
            />
          )}
        </div>

        <PadEarthworkSketchPlanSidebar {...props} />
      </div>
    </>
  );
}
