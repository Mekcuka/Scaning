import { DemPlanBackground } from './DemPlanBackground';
import { PlanPolygonEditorSvg } from './PlanPolygonEditorSvg';
import type { PlanPolygonEditorProps } from './planPolygonEditorTypes';
import { usePlanPolygonEditor } from './usePlanPolygonEditor';

export function PlanPolygonEditor({
  wellsLocal = [],
  showDemOverlay = false,
  demPreview = null,
  demPreviewLoading = false,
  ...props
}: PlanPolygonEditorProps) {
  const view = usePlanPolygonEditor(props);

  return (
    <div ref={view.editorRef} className="pad-earthwork-sketch-editor">
      <div
        ref={view.canvasStackRef}
        className={`pad-earthwork-sketch-editor__canvas-stack${view.isPanning ? ' pad-earthwork-sketch-editor__canvas-stack--panning' : ''}`}
        onPointerDown={view.onPanPointerDown}
        onPointerMove={view.onPanPointerMove}
        onPointerUp={view.onPanPointerUp}
        onPointerCancel={view.onPanPointerCancel}
      >
        {showDemOverlay && (
          <DemPlanBackground
            preview={demPreview}
            viewHalf={view.viewHalf}
            pan={props.viewPan ?? { east_m: 0, north_m: 0 }}
            loading={demPreviewLoading}
          />
        )}
        <PlanPolygonEditorSvg view={view} wellsLocal={wellsLocal} showDemOverlay={showDemOverlay} />
      </div>
      <p className="pad-earthwork-sketch-editor__hint text-xs">
        {view.hint}
        {view.snapEnabled && ' Привязка к сетке 1 м.'}
        {' Колёсико — масштаб; средняя кнопка или Space+перетаскивание — перемещение.'}
        {view.closed && view.perimeter > 0 &&
          ` Периметр: ${view.perimeter.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} м.`}
        {view.envelopeRingPath &&
          ' Оранжевое кольцо — подошва обваловки (W) на верху насыпи; пунктир — внешняя и внутренняя бровка.'}
      </p>
    </div>
  );
}

export default PlanPolygonEditor;
