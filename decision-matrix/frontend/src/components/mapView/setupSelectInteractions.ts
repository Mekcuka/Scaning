import Select from 'ol/interaction/Select';
import Modify from 'ol/interaction/Modify';
import DragBox from 'ol/interaction/DragBox';
import Feature from 'ol/Feature';
import { click, mouseActionButton } from 'ol/events/condition';
import { resolveHoverFeatureIdAtCoordinate } from '../../lib/mapHitTest';
import {
  expandLayerFeatures,
  findSelectableLayerFeature,
  resolveFeatureSelection,
} from './featureSelection';
import type { MapSetupContext } from './mapSetupContext';
import type { MapFeatureSelection } from './types';

export function setupSelectInteractions(ctx: MapSetupContext): {
  select: Select;
  modify: Modify;
  dragBox: DragBox;
} {
  const { refs, layers, interactions } = ctx;
  const { map } = interactions;
  const { pointLayer, lineLayer } = layers;
  const {
    pointSourceRef,
    lineSourceRef,
    selectRef,
    modifyRef,
    dragBoxRef,
    drawModeRef,
    pasteModeRef,
    selectModeRef,
    dragBoxPickRef,
    onFeatureSelectRef,
    onFeatureGroupSelectRef,
    onDragBoxPickRef,
  } = refs;

  const select = new Select({
    condition: click,
    layers: [pointLayer, lineLayer],
    hitTolerance: 6,
  });
  const modify = new Modify({ features: select.getFeatures() });
  const dragBox = new DragBox({
    className: 'ol-dragbox-select',
    condition: (evt) => {
      if (!mouseActionButton(evt)) return false;
      if (dragBoxPickRef.current) {
        if (pasteModeRef.current) return false;
        return true;
      }
      if (drawModeRef.current !== 'select' || selectModeRef.current !== 'box') return false;
      if (pasteModeRef.current) return false;
      // While group is selected, drag moves features (Translate), not a new box.
      if (select.getFeatures().getLength() > 0) return false;
      return true;
    },
  });
  selectRef.current = select;
  modifyRef.current = modify;
  dragBoxRef.current = dragBox;

  select.on('select', (e) => {
    if (drawModeRef.current !== 'select' || selectModeRef.current !== 'single') return;
    const evt = e.mapBrowserEvent;
    const collection = select.getFeatures();
    if (evt) {
      const id = resolveHoverFeatureIdAtCoordinate(
        map,
        pointSourceRef.current,
        lineSourceRef.current,
        evt.coordinate,
        6,
      );
      if (!id) {
        onFeatureSelectRef.current?.(null);
        return;
      }
      const f = findSelectableLayerFeature(
        pointSourceRef.current,
        lineSourceRef.current,
        id,
      );
      if (!f) {
        onFeatureSelectRef.current?.(null);
        return;
      }
      const sel = resolveFeatureSelection(f);
      if (!sel) {
        onFeatureSelectRef.current?.(null);
        return;
      }
      if (collection.getLength() !== 1 || collection.item(0) !== f) {
        collection.clear();
        collection.push(f);
      }
      onFeatureSelectRef.current?.(sel);
      return;
    }
    const f = e.selected[0];
    if (!f) {
      onFeatureSelectRef.current?.(null);
      return;
    }
    const sel = resolveFeatureSelection(f);
    if (!sel) {
      onFeatureSelectRef.current?.(null);
      return;
    }
    onFeatureSelectRef.current?.(sel);
  });

  dragBox.on('boxend', () => {
    const isAutoroadBoxPick = dragBoxPickRef.current;
    const isGroupBoxSelect =
      drawModeRef.current === 'select' && selectModeRef.current === 'box';
    if (!isAutoroadBoxPick && !isGroupBoxSelect) return;

    const extent = dragBox.getGeometry().getExtent();
    const collection = select.getFeatures();
    collection.clear();

    const selections: MapFeatureSelection[] = [];
    const seen = new Set<string>();
    const addFeature = (layerFeature: Feature) => {
      const members = expandLayerFeatures(layerFeature);
      let addedVisual = false;
      for (const inner of members) {
        const sel = resolveFeatureSelection(inner);
        if (!sel || seen.has(sel.id)) continue;
        seen.add(sel.id);
        selections.push(sel);
        if (!isAutoroadBoxPick && !addedVisual) {
          collection.push(layerFeature);
          addedVisual = true;
        }
      }
    };

    if (!isAutoroadBoxPick) {
      lineSourceRef.current.forEachFeatureIntersectingExtent(extent, (feature) => {
        addFeature(feature);
      });
    }
    pointSourceRef.current.forEachFeatureIntersectingExtent(extent, (feature) => {
      addFeature(feature);
    });

    if (isAutoroadBoxPick) {
      onDragBoxPickRef.current?.(selections);
    } else {
      onFeatureGroupSelectRef.current?.(selections);
    }
  });

  return { select, modify, dragBox };
}
