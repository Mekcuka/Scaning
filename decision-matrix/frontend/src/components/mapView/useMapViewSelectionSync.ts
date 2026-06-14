import { useEffect } from 'react';
import Feature from 'ol/Feature';
import { findSelectableLayerFeature, resolveFeatureSelection } from './featureSelection';
import type { MapViewRefs } from './mapViewRefs';
import type { MapViewProps } from './types';

export function useMapViewSelectionSync(
  refs: MapViewRefs,
  {
    selectedFeatureId = null,
    selectedFeatureIds = [],
    selectMode = 'single',
    drawMode = 'select',
    editMode = false,
    pois = [],
    infraObjects = [],
  }: Pick<
    MapViewProps,
    | 'selectedFeatureId'
    | 'selectedFeatureIds'
    | 'selectMode'
    | 'drawMode'
    | 'editMode'
    | 'pois'
    | 'infraObjects'
  >,
): void {
  useEffect(() => {
    if (selectMode !== 'single' || drawMode !== 'select') return;
    const select = refs.selectRef.current;
    if (!select) return;
    const collection = select.getFeatures();

    if (!selectedFeatureId) {
      if (collection.getLength() > 0) collection.clear();
      return;
    }

    const current = collection.item(0);
    const currentSel = current ? resolveFeatureSelection(current) : null;
    if (currentSel?.id === selectedFeatureId) return;

    collection.clear();
    const feature = findSelectableLayerFeature(
      refs.pointSourceRef.current,
      refs.lineSourceRef.current,
      selectedFeatureId,
      refs.nodePointSourceRef.current,
    );
    if (feature) collection.push(feature);
  }, [selectedFeatureId, selectMode, drawMode, editMode, pois, infraObjects]);

  useEffect(() => {
    if (selectMode !== 'box') return;
    const select = refs.selectRef.current;
    if (!select) return;
    const collection = select.getFeatures();
    const targetIds = new Set(selectedFeatureIds);
    if (targetIds.size === 0) {
      collection.clear();
      return;
    }
    if (collection.getLength() > 0) {
      const currentIds = new Set<string>();
      collection.forEach((f) => {
        const sel = resolveFeatureSelection(f);
        if (sel) currentIds.add(sel.id);
      });
      if (
        currentIds.size === targetIds.size &&
        [...targetIds].every((id) => currentIds.has(id))
      ) {
        return;
      }
    }
    collection.clear();
    const matchesSelection = (f: Feature) => {
      const sel = resolveFeatureSelection(f);
      return sel != null && targetIds.has(sel.id);
    };
    refs.nodePointSourceRef.current.getFeatures().forEach((f) => {
      if (f.get('subtype') !== 'draft' && matchesSelection(f)) collection.push(f);
    });
    refs.pointSourceRef.current.getFeatures().forEach((f) => {
      if (f.get('subtype') !== 'draft' && matchesSelection(f)) collection.push(f);
    });
    refs.lineSourceRef.current.getFeatures().forEach((f) => {
      if (f.get('subtype') !== 'draft' && matchesSelection(f)) collection.push(f);
    });
  }, [selectedFeatureIds, selectMode, editMode, pois, infraObjects]);

  useEffect(() => {
    const select = refs.selectRef.current;
    if (!select) return;
    const infraIds = new Set(infraObjects.map((o) => o.id));
    const selected = select.getFeatures();
    const stale: Feature[] = [];
    selected.forEach((f) => {
      if (f.get('featureKind') !== 'infra') return;
      const featureInfraId =
        (f.get('infra_object_id') as string | undefined) ?? (f.get('id') as string);
      if (!infraIds.has(featureInfraId)) stale.push(f);
    });
    stale.forEach((f) => selected.remove(f));
  }, [infraObjects]);
}
