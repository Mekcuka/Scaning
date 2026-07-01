import type { InfraObject } from '../../lib/api';
import { isPadSubtype } from '../../lib/infraPadEarthwork';
import { PadEarthworkSketchModal } from '../padEarthwork/PadEarthworkSketchModal';
import { PanelSection } from './panelUi';
import { InfraPadEarthworkSectionForm } from './InfraPadEarthworkSectionForm';
import { useInfraPadEarthworkSection } from './useInfraPadEarthworkSection';
import type { PadEarthworkDetailBridge } from './padEarthworkDetailBridge';

interface InfraPadEarthworkSectionProps {
  projectId: string;
  infraObject: InfraObject;
  readOnly: boolean;
  setSandDemandM3: (value: string) => void;
  padMarginLeftM: string;
  setPadMarginLeftM: (value: string) => void;
  padMarginBottomM: string;
  setPadMarginBottomM: (value: string) => void;
  padMarginTopM: string;
  setPadMarginTopM: (value: string) => void;
  padMarginEndM: string;
  setPadMarginEndM: (value: string) => void;
  padWellCount: string;
  setPadWellCount: (value: string) => void;
  padWellsPerGroup: string;
  setPadWellsPerGroup: (value: string) => void;
  padWellSpacingM: string;
  setPadWellSpacingM: (value: string) => void;
  padGroupSpacingM: string;
  setPadGroupSpacingM: (value: string) => void;
  onPadEarthworkBridgeChange?: (bridge: PadEarthworkDetailBridge | null) => void;
}

export function InfraPadEarthworkSection(props: InfraPadEarthworkSectionProps) {
  const {
    projectId,
    infraObject,
    readOnly,
    setSandDemandM3,
    padMarginLeftM,
    setPadMarginLeftM,
    padMarginBottomM,
    setPadMarginBottomM,
    padMarginTopM,
    setPadMarginTopM,
    padMarginEndM,
    setPadMarginEndM,
    padWellCount,
    setPadWellCount,
    padWellsPerGroup,
    setPadWellsPerGroup,
    padWellSpacingM,
    setPadWellSpacingM,
    padGroupSpacingM,
    setPadGroupSpacingM,
    onPadEarthworkBridgeChange,
  } = props;

  const model = useInfraPadEarthworkSection({
    projectId,
    infraObject,
    padMarginLeftM,
    padMarginBottomM,
    padMarginTopM,
    padMarginEndM,
    padWellCount,
    padWellsPerGroup,
    padWellSpacingM,
    padGroupSpacingM,
    onBridgeChange: onPadEarthworkBridgeChange,
  });

  const isPad = isPadSubtype(infraObject.subtype);

  return (
    <PanelSection title="Площадка / земляные работы" card>
      <InfraPadEarthworkSectionForm
        projectId={projectId}
        infraObject={infraObject}
        readOnly={readOnly}
        setSandDemandM3={setSandDemandM3}
        model={model}
      />

      {model.sketchOpen && (
        <PadEarthworkSketchModal
          projectId={projectId}
          objectId={infraObject.id}
          readOnly={readOnly}
          showGenerator={isPad}
          lengthM={model.lengthM}
          widthM={model.widthM}
          heightM={model.heightM}
          rotationDeg={model.rotationDeg}
          referenceElevationM={model.referenceElevationM}
          initialSketch={model.savedSketch}
          initialWellsLocal={model.savedWellsLocal}
          initialEnvelope={model.savedEnvelope}
          padWellCount={padWellCount}
          setPadWellCount={setPadWellCount}
          padWellsPerGroup={padWellsPerGroup}
          setPadWellsPerGroup={setPadWellsPerGroup}
          padWellSpacingM={padWellSpacingM}
          setPadWellSpacingM={setPadWellSpacingM}
          padGroupSpacingM={padGroupSpacingM}
          setPadGroupSpacingM={setPadGroupSpacingM}
          padMarginLeftM={padMarginLeftM}
          setPadMarginLeftM={setPadMarginLeftM}
          padMarginBottomM={padMarginBottomM}
          setPadMarginBottomM={setPadMarginBottomM}
          padMarginTopM={padMarginTopM}
          setPadMarginTopM={setPadMarginTopM}
          padMarginEndM={padMarginEndM}
          setPadMarginEndM={setPadMarginEndM}
          setRotationDeg={model.setRotationDeg}
          onClose={() => model.setSketchOpen(false)}
          onApplyToFields={(fields) => {
            model.setLengthM(fields.lengthM);
            model.setWidthM(fields.widthM);
            model.setRotationDeg(fields.rotationDeg);
            model.setHeightM(fields.heightM);
            model.setReferenceElevationM(fields.referenceElevationM);
            model.setResult(null);
          }}
          onComputeSuccess={(data) => {
            model.setResult(data);
            model.invalidatePadQueries();
          }}
          onSaveSuccess={model.invalidatePadQueries}
          onApplySandDemand={(fill) => setSandDemandM3(String(fill))}
          demStatus={model.demStatus}
          terrainMode={model.terrainMode}
        />
      )}
    </PanelSection>
  );
}
