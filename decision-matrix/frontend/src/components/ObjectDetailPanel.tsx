export type { SelectedFeature } from './objectDetailPanel/types';

import { PoiParamsForm } from './PoiParamsForm';
import { POI_TAB_SECTIONS } from './objectDetailPanel/constants';
import { DetailPanelTabs } from './objectDetailPanel/panelUi';
import { useObjectDetailPanel } from './objectDetailPanel/useObjectDetailPanel';
import { ObjectDetailPanelHeader } from './objectDetailPanel/ObjectDetailPanelHeader';
import { ObjectDetailPanelFooter } from './objectDetailPanel/ObjectDetailPanelFooter';
import { InfraDetailMainTab } from './objectDetailPanel/InfraDetailMainTab';
import { InfraDetailLogisticsTab } from './objectDetailPanel/InfraDetailLogisticsTab';
import { InfraDetailExtraTab } from './objectDetailPanel/InfraDetailExtraTab';
import { InfraDetailProfileTab } from './objectDetailPanel/InfraDetailProfileTab';
import { InfraDetailTrajectoriesTab } from './objectDetailPanel/InfraDetailTrajectoriesTab';
import {
  PointFootprintLineConnectionsSection,
  PointFootprintLineConnectPickControls,
} from './objectDetailPanel/PointFootprintLineConnectionsSection';
import type { ObjectDetailPanelProps } from './objectDetailPanel/types';
import type { PointFootprintLineConnections } from '../lib/padFootprintLineAttach';
import { useProjectFootprintConnectionTemplate } from '../hooks/useProjectFootprintConnectionTemplate';
import { readBottomholeCopySources } from '../lib/wellBottomholeElevation';
import { bottomholeFormFieldsToProperties } from './objectDetailPanel/bottomholeFormFields';

export function ObjectDetailPanel({
  selection,
  layers,
  map3dCustomModels = [],
  infraObjects = [],
  mapInFootprints = false,
  footprintLineConnectPickSubtype = null,
  onFootprintLineConnectPickSubtypeChange,
  onFootprintLineConnectionsPersist,
  onSave,
  onDelete,
  onClose,
  onCopy,
  onCut,
  saving,
  readOnly = false,
  deleteDisabled = false,
}: ObjectDetailPanelProps) {
  const panel = useObjectDetailPanel({
    selection,
    layers,
    map3dCustomModels,
    infraObjects,
    onSave,
    onClose,
    readOnly,
    saving,
  });
  const { template: projectFootprintTemplate, isLoading: projectTemplateLoading } =
    useProjectFootprintConnectionTemplate(panel.mapProjectId);

  const handleFootprintLineConnectionsChange = (next: PointFootprintLineConnections) => {
    panel.setPointFootprintLineConnections(next);
    if (panel.infraObject && onFootprintLineConnectionsPersist) {
      void onFootprintLineConnectionsPersist(panel.infraObject.id, next);
    }
  };

  return (
    <div
      className="object-detail-panel"
      role="dialog"
      aria-label={panel.isPoi ? 'Точка интереса' : 'Объект'}
    >
      <ObjectDetailPanelHeader
        readOnly={readOnly}
        displayName={panel.displayName}
        setDisplayName={panel.setDisplayName}
        isDirty={panel.isDirty}
        isPoi={panel.isPoi}
        subtypeLabel={panel.subtypeLabel}
        headerIcon={panel.headerIcon}
        onCopy={onCopy}
        onCut={onCut}
        onClose={onClose}
      />

      {panel.isPoi && panel.poiForm ? (
        <DetailPanelTabs
          tabs={panel.poiTabs}
          active={panel.poiTab}
          onChange={panel.setPoiTab}
          tabDirty={panel.poiTabDirty}
          ariaLabel="Параметры точки интереса"
          showLabels={false}
        />
      ) : (
        <DetailPanelTabs
          tabs={panel.infraTabs}
          active={panel.infraTab}
          onChange={panel.setInfraTab}
          tabDirty={panel.infraTabDirty}
          ariaLabel="Параметры объекта"
          showLabels={false}
        />
      )}

      <div className="object-detail-panel__body">
        {panel.isPoi && panel.poiForm ? (
          <PoiParamsForm
            value={panel.poiForm}
            onChange={panel.setPoiForm}
            defaults={panel.defaults}
            readOnly={readOnly}
            coordsReadOnly={readOnly}
            flat
            sections={POI_TAB_SECTIONS[panel.poiTab]}
          />
        ) : (
          <>
            {panel.infraTab === 'main' && (
              <InfraDetailMainTab
                readOnly={readOnly}
                subtype={panel.subtype}
                setSubtype={panel.setSubtype}
                subtypeLocked={panel.subtypeLocked}
                infraSubtypeOptions={panel.infraSubtypeOptions}
                layers={layers}
                layerId={panel.layerId}
                setLayerId={panel.setLayerId}
                layerName={panel.layerName}
                name={panel.name}
                sparkType={panel.sparkType}
                showEntryDateField={panel.showEntryDateField}
                entryDate={panel.entryDate}
                setEntryDate={panel.setEntryDate}
                showThroughputCapacity={panel.showThroughputCapacity}
                capacityUnit={panel.capacityUnit}
                capacityValue={panel.capacityValue}
                setCapacityValue={panel.setCapacityValue}
                throughputCapacity={panel.throughputCapacity}
                showPadWellCountField={panel.showPadWellCountField}
                padWellCount={panel.padWellCount}
                padWellCountDerivedFromBottomholes={panel.padWellCountDerivedFromBottomholes}
                linkedBottomholesCount={panel.linkedBottomholesCount}
                setPadWellCount={panel.setPadWellCount}
                saving={saving}
                isLine={panel.isLine}
                isBottomhole={panel.isBottomhole}
                linkedBottomholePad={panel.linkedBottomholePad}
                endLon={panel.endLon}
                setEndLon={panel.setEndLon}
                endLat={panel.endLat}
                setEndLat={panel.setEndLat}
                z={panel.z}
                setZ={panel.setZ}
                zHeel={panel.zHeel}
                setZHeel={panel.setZHeel}
                zToe={panel.zToe}
                setZToe={panel.setZToe}
                onBottomholeFieldsChange={panel.patchBottomholeFields}
                bottomholeFields={panel.bottomholeFields}
                bottomholeCopySources={
                  panel.infraObject
                    ? readBottomholeCopySources(
                        panel.infraObject,
                        panel.linkedBottomholePad,
                        bottomholeFormFieldsToProperties(panel.bottomholeFields),
                      )
                    : undefined
                }
                bottomholeProjectId={panel.mapProjectId}
                bottomholeObject={panel.infraObject}
                bottomholePadOptions={infraObjects.filter(
                  (o) => o.subtype === 'oil_pad' || o.subtype === 'gas_pad',
                )}
                bottomholeInfraObjects={infraObjects}
                copyCoordinatesText={panel.copyCoordinatesText}
                lineLengthLabel={panel.lineLengthLabel}
                lineLengthFromProfile={panel.lineLengthFromProfile}
                lineCoords={panel.lineCoords}
                lon={panel.lon}
                setLon={panel.setLon}
                lat={panel.lat}
                setLat={panel.setLat}
                copyCoordinates={panel.copyCoordinates}
                description={panel.description}
                setDescription={panel.setDescription}
              />
            )}
            {panel.infraTab === 'main' &&
              mapInFootprints &&
              panel.showFootprintLineConnectionsSection &&
              panel.infraObject && (
                <>
                  <PointFootprintLineConnectionsSection
                    readOnly={readOnly}
                    point={panel.infraObject}
                    connections={panel.pointFootprintLineConnections}
                    onConnectionsChange={handleFootprintLineConnectionsChange}
                    mapInFootprints={mapInFootprints}
                    projectTemplate={projectFootprintTemplate}
                    templateLoading={projectTemplateLoading}
                  />
                  <PointFootprintLineConnectPickControls
                    pickLineSubtype={footprintLineConnectPickSubtype}
                    onPickLineSubtypeChange={onFootprintLineConnectPickSubtypeChange ?? (() => {})}
                    readOnly={readOnly}
                    mapInFootprints={mapInFootprints}
                    showSection={panel.showFootprintLineConnectionsSection}
                  />
                </>
              )}

            {panel.infraTab === 'logistics' && (
              <InfraDetailLogisticsTab
                showPadEarthworkSection={panel.showPadEarthworkSection}
                projectId={panel.mapProjectId}
                infraObject={panel.infraObject}
                showSandQuarryFields={panel.showSandQuarryFields}
                showSandDemandField={panel.showSandDemandField}
                readOnly={readOnly}
                sandInitialM3={panel.sandInitialM3}
                setSandInitialM3={panel.setSandInitialM3}
                sandCurrentM3={panel.sandCurrentM3}
                setSandCurrentM3={panel.setSandCurrentM3}
                sandVolumeMode={panel.sandVolumeMode}
                setSandVolumeMode={panel.setSandVolumeMode}
                sandDemandM3={panel.sandDemandM3}
                setSandDemandM3={panel.setSandDemandM3}
                sandVolumeByYear={panel.sandVolumeByYear}
                setSandVolumeByYear={panel.setSandVolumeByYear}
                infraObjectId={panel.infraObjectId}
                sandLogistics={panel.sandLogistics ?? undefined}
                quarryVolumeWarning={panel.quarryVolumeWarning}
                padMarginLeftM={panel.padMarginLeftM}
                setPadMarginLeftM={panel.setPadMarginLeftM}
                padMarginBottomM={panel.padMarginBottomM}
                setPadMarginBottomM={panel.setPadMarginBottomM}
                padMarginTopM={panel.padMarginTopM}
                setPadMarginTopM={panel.setPadMarginTopM}
                padMarginEndM={panel.padMarginEndM}
                setPadMarginEndM={panel.setPadMarginEndM}
                padWellCount={panel.padWellCount}
                setPadWellCount={panel.setPadWellCount}
                padWellsPerGroup={panel.padWellsPerGroup}
                setPadWellsPerGroup={panel.setPadWellsPerGroup}
                padWellSpacingM={panel.padWellSpacingM}
                setPadWellSpacingM={panel.setPadWellSpacingM}
                padGroupSpacingM={panel.padGroupSpacingM}
                setPadGroupSpacingM={panel.setPadGroupSpacingM}
                onPadEarthworkBridgeChange={panel.onPadEarthworkBridgeChange}
              />
            )}

            {panel.infraTab === 'trajectories' && (
              <InfraDetailTrajectoriesTab
                showTrajectoriesSection={panel.showTrajectoriesSection}
                projectId={panel.mapProjectId}
                infraObject={panel.infraObject}
                infraObjects={infraObjects}
                readOnly={readOnly}
              />
            )}

            {panel.infraTab === 'profile' && (
              <InfraDetailProfileTab
                projectId={panel.mapProjectId}
                infraObject={panel.infraObject}
                readOnly={readOnly}
                lineProfileStepM={panel.lineProfileStepM}
                setLineProfileStepM={panel.setLineProfileStepM}
              />
            )}

            {panel.infraTab === 'extra' && (
              <InfraDetailExtraTab
                readOnly={readOnly}
                render3dHeight={panel.render3dHeight}
                setRender3dHeight={panel.setRender3dHeight}
                render3dDiameter={panel.render3dDiameter}
                setRender3dDiameter={panel.setRender3dDiameter}
                render3dBase={panel.render3dBase}
                setRender3dBase={panel.setRender3dBase}
                render3dScale={panel.render3dScale}
                setRender3dScale={panel.setRender3dScale}
                render3dVisible={panel.render3dVisible}
                setRender3dVisible={panel.setRender3dVisible}
                infraObject={panel.infraObject}
                render3dStyle={panel.render3dStyle}
                setRender3dStyle={panel.setRender3dStyle}
                render3dModelId={panel.render3dModelId}
                setRender3dModelId={panel.setRender3dModelId}
                render3dModelOptions={panel.render3dModelOptions}
              />
            )}
          </>
        )}
      </div>

      <ObjectDetailPanelFooter
        readOnly={readOnly}
        saving={saving}
        isDirty={panel.isDirty}
        deleteDisabled={deleteDisabled}
        handleSave={panel.handleSave}
        onDelete={onDelete}
      />
    </div>
  );
}
