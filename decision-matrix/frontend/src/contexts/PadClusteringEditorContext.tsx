import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'react-router-dom';

import { useActiveProject } from '../hooks/useActiveProject';
import { filterPadObjects, usePadClusteringEditor } from '../hooks/usePadClusteringEditor';
import { usePermissions } from '../hooks/usePermissions';
import { useProjectInfraObjects } from '../hooks/useProjectData';

type PadClusteringEditorValue = ReturnType<typeof usePadClusteringEditor> & {
  projectId: string | null;
  activePadId: string;
  pads: ReturnType<typeof filterPadObjects>;
  infraLoading: boolean;
  readOnly: boolean;
  selectedWellIndex: number | null;
  setSelectedWellIndex: (index: number | null) => void;
  handlePadChange: (padId: string) => void;
};

const PadClusteringEditorContext = createContext<PadClusteringEditorValue | null>(null);

export function PadClusteringEditorProvider({ children }: { children: ReactNode }) {
  const { projectId } = useActiveProject();
  const { can } = usePermissions();
  const readOnly = !can('write_infra');
  const [searchParams, setSearchParams] = useSearchParams();
  const padIdFromUrl = searchParams.get('padId') ?? '';

  const { data: infraObjects = [], isLoading: infraLoading } = useProjectInfraObjects(projectId, {
    refetchOnMount: 'always',
  });
  const pads = useMemo(() => filterPadObjects(infraObjects), [infraObjects]);

  const [selectedPadId, setSelectedPadId] = useState('');
  const [selectedWellIndex, setSelectedWellIndex] = useState<number | null>(null);

  useEffect(() => {
    if (padIdFromUrl && pads.some((p) => p.id === padIdFromUrl)) {
      setSelectedPadId(padIdFromUrl);
      return;
    }
    if (!selectedPadId && pads.length > 0) {
      setSelectedPadId(pads[0]!.id);
    }
  }, [padIdFromUrl, pads, selectedPadId]);

  const activePadId = selectedPadId || pads[0]?.id || '';
  const editor = usePadClusteringEditor(projectId, activePadId || null, infraObjects);

  useEffect(() => {
    setSelectedWellIndex(null);
  }, [activePadId]);

  const handlePadChange = useCallback(
    (padId: string) => {
      setSelectedPadId(padId);
      if (padId) {
        setSearchParams({ padId }, { replace: true });
      } else {
        setSearchParams({}, { replace: true });
      }
    },
    [setSearchParams],
  );

  const value = useMemo(
    (): PadClusteringEditorValue => ({
      ...editor,
      projectId: projectId ?? null,
      activePadId,
      pads,
      infraLoading,
      readOnly,
      selectedWellIndex,
      setSelectedWellIndex,
      handlePadChange,
    }),
    [
      editor,
      projectId,
      activePadId,
      pads,
      infraLoading,
      readOnly,
      selectedWellIndex,
      handlePadChange,
    ],
  );

  return (
    <PadClusteringEditorContext.Provider value={value}>{children}</PadClusteringEditorContext.Provider>
  );
}

export function usePadClusteringEditorContext(): PadClusteringEditorValue {
  const ctx = useContext(PadClusteringEditorContext);
  if (!ctx) {
    throw new Error('usePadClusteringEditorContext must be used within PadClusteringEditorProvider');
  }
  return ctx;
}
