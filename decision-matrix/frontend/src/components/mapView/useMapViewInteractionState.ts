import { useEffect } from 'react';
import { applyVectorLayerUpdateWhileInteracting } from '../../lib/mapFeatureGeometrySync';
import type { MapViewRefs } from './mapViewRefs';
import type { MapViewProps } from './types';

export function useMapViewInteractionState(
  refs: MapViewRefs,
  {
    drawMode = 'select',
    selectMode = 'single',
    editMode = false,
    pasteMode = false,
    dragBoxPick = false,
    selectedFeatureIds = [],
    onBatchGeometryChange,
    layers = [],
  }: Pick<
    MapViewProps,
    | 'drawMode'
    | 'selectMode'
    | 'editMode'
    | 'pasteMode'
    | 'dragBoxPick'
    | 'selectedFeatureIds'
    | 'onBatchGeometryChange'
    | 'layers'
  >,
): void {
  const {
    selectRef,
    modifyRef,
    translateRef,
    dragBoxRef,
    dragPanRef,
    containerRef,
    onBatchGeometryChangeRef,
    suppressDataSyncRef,
    pointLayerRef,
    lineLayerRef,
    mapRef,
  } = refs;

  useEffect(() => {
    const isSelect = drawMode === 'select';
    const isRuler = drawMode === 'ruler';
    const isSingle = isSelect && selectMode === 'single';
    const isBox = isSelect && selectMode === 'box';
    const isDragBoxPick = dragBoxPick;
    const canModify = editMode && isSingle;
    const hasGroupSelection = selectedFeatureIds.length > 0;
    const canTranslate =
      editMode && isBox && hasGroupSelection && !!onBatchGeometryChangeRef.current;
    const pasteActive = pasteMode;
    const boxDrawing = (isBox && !hasGroupSelection) || isDragBoxPick;
    selectRef.current?.setActive(isSingle && !pasteActive);
    modifyRef.current?.setActive(canModify && !pasteActive);
    translateRef.current?.setActive(canTranslate && !pasteActive);
    dragBoxRef.current?.setActive(boxDrawing && !pasteActive);
    dragPanRef.current?.setActive(pasteActive || !boxDrawing || (isBox && hasGroupSelection));
    if (containerRef.current) {
      const isPointPlace = drawMode === 'point' || drawMode === 'poi';
      const cursor = pasteActive || isRuler || isPointPlace || boxDrawing
        ? 'crosshair'
        : canTranslate
          ? 'grab'
          : !editMode
            ? 'default'
            : isSelect
              ? 'default'
              : 'crosshair';
      containerRef.current.style.cursor = cursor;
    }
    if (!isSelect) {
      selectRef.current?.getFeatures().clear();
    }
  }, [
    drawMode,
    selectMode,
    editMode,
    pasteMode,
    dragBoxPick,
    selectedFeatureIds.length,
    onBatchGeometryChange,
  ]);

  useEffect(() => {
    if (!editMode) {
      suppressDataSyncRef.current = false;
    }
  }, [editMode]);

  useEffect(() => {
    applyVectorLayerUpdateWhileInteracting(
      pointLayerRef.current,
      lineLayerRef.current,
      editMode,
    );
  }, [editMode]);

  useEffect(() => {
    pointLayerRef.current?.changed();
  }, [layers]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.getLayers().item(4)?.changed();
    mapRef.current.getLayers().item(5)?.changed();
  }, [layers]);
}
