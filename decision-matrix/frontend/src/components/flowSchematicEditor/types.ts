import type { FlowSchematicDto } from '../../lib/flowSchematic';
import type { POI } from '../../lib/api';

export type FlowSchematicEditorProps = {
  schematic: FlowSchematicDto;
  poi: POI | null;
  onSave: (dto: FlowSchematicDto) => void;
  onPersistCapacity?: (dto: FlowSchematicDto) => void;
  onPlannedProductionChange?: (volume: number) => void;
  onReset: () => void;
  saving?: boolean;
  resetting?: boolean;
  /** Force read-only mode (e.g. viewer role). */
  forceReadOnly?: boolean;
  /** Tailwind height class for the canvas, e.g. h-[min(40vh,400px)] */
  canvasHeightClass?: string;
};
