import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

import { usePadClusteringEditorContext } from './PadClusteringEditorContext';
import {
  listLateralProfileSubjects,
  listMainProfileSubjects,
  resolveProfilePoints,
  type ProfileSubject,
  type TrajectoryProfilePoint,
} from '../lib/wellTrajectoryProfile';

type PadClusteringProfileSubjectValue = {
  allSubjects: ProfileSubject[];
  selectedSubject: ProfileSubject | null;
  selectedSubjectId: string;
  selectOptions: { value: string; label: string }[];
  handleSubjectChange: (id: string) => void;
  profilePoints: TrajectoryProfilePoint[];
};

const PadClusteringProfileSubjectContext =
  createContext<PadClusteringProfileSubjectValue | null>(null);

export function PadClusteringProfileSubjectProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const isProfile = pathname.includes('/pad-clustering/profile/');

  const {
    trajectories,
    linkedBottomholes,
    activeGeoDraft,
    selectedWellIndex,
    setSelectedWellIndex,
    pad,
  } = usePadClusteringEditorContext();

  const [searchParams, setSearchParams] = useSearchParams();
  const subjectFromUrl = searchParams.get('subject') ?? '';

  const mainSubjects = useMemo(() => listMainProfileSubjects(trajectories), [trajectories]);
  const lateralSubjects = useMemo(
    () =>
      listLateralProfileSubjects(
        linkedBottomholes,
        activeGeoDraft.trees,
        pad?.lon ?? 0,
        pad?.lat ?? 0,
      ),
    [linkedBottomholes, activeGeoDraft.trees, pad?.lon, pad?.lat],
  );

  const allSubjects = useMemo(
    () => [...mainSubjects, ...lateralSubjects],
    [mainSubjects, lateralSubjects],
  );

  const [selectedSubjectId, setSelectedSubjectId] = useState('');

  useEffect(() => {
    if (!isProfile) return;

    if (subjectFromUrl && allSubjects.some((s) => s.id === subjectFromUrl)) {
      setSelectedSubjectId(subjectFromUrl);
      return;
    }
    const wellParam = searchParams.get('well');
    if (wellParam != null) {
      const idx = Number(wellParam);
      if (Number.isFinite(idx)) {
        const match = mainSubjects.find((s) => s.wellIndex === idx);
        if (match) {
          setSelectedSubjectId(match.id);
          return;
        }
      }
    }
    if (selectedWellIndex != null) {
      const match = mainSubjects.find((s) => s.wellIndex === selectedWellIndex);
      if (match) {
        setSelectedSubjectId(match.id);
        return;
      }
    }
    if (allSubjects.length === 0) {
      setSelectedSubjectId('');
      return;
    }
    if (!selectedSubjectId || !allSubjects.some((s) => s.id === selectedSubjectId)) {
      setSelectedSubjectId(allSubjects[0]!.id);
    }
  }, [
    isProfile,
    subjectFromUrl,
    allSubjects,
    mainSubjects,
    searchParams,
    selectedWellIndex,
    selectedSubjectId,
  ]);

  const selectedSubject: ProfileSubject | null =
    allSubjects.find((s) => s.id === selectedSubjectId) ?? null;

  const profilePoints = useMemo(() => {
    if (!isProfile || !selectedSubject) return [];
    return resolveProfilePoints(
      selectedSubject,
      trajectories,
      activeGeoDraft.trees,
      linkedBottomholes,
    );
  }, [isProfile, selectedSubject, trajectories, activeGeoDraft.trees, linkedBottomholes]);

  const selectOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (const s of mainSubjects) {
      opts.push({ value: s.id, label: `[Осн.] ${s.label}` });
    }
    for (const s of lateralSubjects) {
      opts.push({ value: s.id, label: `[Доп.] ${s.label}` });
    }
    return opts;
  }, [mainSubjects, lateralSubjects]);

  const handleSubjectChange = useCallback(
    (id: string) => {
      setSelectedSubjectId(id);
      const subject = allSubjects.find((s) => s.id === id);
      const padId = searchParams.get('padId');
      if (subject?.kind === 'main') {
        setSelectedWellIndex(subject.wellIndex);
        setSearchParams(
          padId
            ? { padId, subject: id, well: String(subject.wellIndex) }
            : { subject: id, well: String(subject.wellIndex) },
          { replace: true },
        );
      } else {
        setSearchParams(padId ? { padId, subject: id } : { subject: id }, { replace: true });
      }
    },
    [allSubjects, searchParams, setSearchParams, setSelectedWellIndex],
  );

  const value = useMemo(
    (): PadClusteringProfileSubjectValue => ({
      allSubjects,
      selectedSubject,
      selectedSubjectId,
      selectOptions,
      handleSubjectChange,
      profilePoints,
    }),
    [allSubjects, selectedSubject, selectedSubjectId, selectOptions, profilePoints, handleSubjectChange],
  );

  return (
    <PadClusteringProfileSubjectContext.Provider value={value}>
      {children}
    </PadClusteringProfileSubjectContext.Provider>
  );
}

export function usePadClusteringProfileSubject(): PadClusteringProfileSubjectValue {
  const ctx = useContext(PadClusteringProfileSubjectContext);
  if (!ctx) {
    throw new Error(
      'usePadClusteringProfileSubject must be used within PadClusteringProfileSubjectProvider',
    );
  }
  return ctx;
}
