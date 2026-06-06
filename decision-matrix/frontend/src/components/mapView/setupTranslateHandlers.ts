import Feature from 'ol/Feature';
import Translate from 'ol/interaction/Translate';
import { syncOuterGeometryToInnerFeatures } from '../../lib/mapFeatureGeometrySync';
import type { MapSetupContext } from './mapSetupContext';
import { createApplyLinkedLineDrag } from './translateHandlers/createApplyLinkedLineDrag';
import { bindTranslateEndHandler } from './translateHandlers/onTranslateEnd';
import { bindTranslateStartHandler } from './translateHandlers/onTranslateStart';

export function setupTranslateHandlers(ctx: MapSetupContext): {
  translate: Translate;
  applyLinkedLineDrag: () => void;
} {
  const { refs, interactions } = ctx;
  const { map, select, modify, dragBox } = interactions;
  const {
    lineSourceRef,
    lineLayerRef,
    pointLayerRef,
    nodePointLayerRef,
    translateRef,
    editModeRef,
    linkedLineDragRef,
  } = refs;

  const translate = new Translate({ features: select.getFeatures() });
  translateRef.current = translate;

  const applyLinkedLineDrag = createApplyLinkedLineDrag({
    select,
    editModeRef,
    linkedLineDragRef,
    lineSourceRef,
    lineLayerRef,
  });

  bindTranslateStartHandler(ctx, translate);

  translate.on('translating', () => {
    const selected: Feature[] = [];
    select.getFeatures().forEach((f) => selected.push(f));
    syncOuterGeometryToInnerFeatures(selected);
    pointLayerRef.current?.changed();
    nodePointLayerRef.current?.changed();
    lineLayerRef.current?.changed();
    applyLinkedLineDrag();
  });

  bindTranslateEndHandler(ctx, translate);

  map.addInteraction(select);
  map.addInteraction(modify);
  map.addInteraction(dragBox);
  map.addInteraction(translate);
  dragBox.setActive(false);
  translate.setActive(false);

  return { translate, applyLinkedLineDrag };
}
