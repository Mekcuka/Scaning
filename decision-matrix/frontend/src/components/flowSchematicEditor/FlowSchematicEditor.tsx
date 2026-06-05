import { ReactFlowProvider } from '@xyflow/react';
import { FlowSchematicEditorInner } from './FlowSchematicEditorInner';
import type { FlowSchematicEditorProps } from './types';

export function FlowSchematicEditor(props: FlowSchematicEditorProps) {
  return (
    <ReactFlowProvider>
      <FlowSchematicEditorInner {...props} />
    </ReactFlowProvider>
  );
}
