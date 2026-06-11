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
import type { ObjectDetailPanelProps } from './objectDetailPanel/types';

export function ObjectDetailPanel({
  selection,
  layers,
  map3dCustomModels = [],
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
    onSave,
    onClose,
    readOnly,
    saving,
  });

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
                saving={saving}
                isLine={panel.isLine}
                lineLengthLabel={panel.lineLengthLabel}
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

            {panel.infraTab === 'logistics' && (
              <InfraDetailLogisticsTab
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
              />
            )}

            {panel.infraTab === 'extra' && (
              <InfraDetailExtraTab
                readOnly={readOnly}
                render3dHeight={panel.render3dHeight}
                setRender3dHeight={panel.setRender3dHeight}
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
