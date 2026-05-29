import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  RANKING_DEFAULT_EXPERT,
  type POI,
  type RankingMatrix,
  type RankingRunResult,
  type RankingSettings,
  type Scenario,
} from '../../lib/api';
import { useAppStore } from '../../store';

export type RankingContextValue = {
  projectId: string | null;
  pois: POI[];
  poisLoading: boolean;
  activePoiId: string;
  setSelectedPoiId: (id: string) => void;
  poiScenarios: Scenario[];
  rankingSettings: RankingSettings | undefined;
  settingsLoading: boolean;
  matrix: RankingMatrix | undefined;
  matrixLoading: boolean;
  result: RankingRunResult | null;
  calculating: boolean;
  calculate: (opts?: { toast?: boolean }) => void;
  updateSettings: (data: Partial<RankingSettings>) => Promise<RankingSettings>;
  settingsSaving: boolean;
  storedExpertKeys: Set<string>;
  invalidateAll: () => void;
  refreshAfterAnalyze: () => Promise<void>;
};

const RankingContext = createContext<RankingContextValue | null>(null);

export function RankingProvider({ children }: { children: ReactNode }) {
  const projectId = useAppStore((s) => s.currentProjectId);
  const pushToast = useAppStore((s) => s.pushToast);
  const queryClient = useQueryClient();
  const [selectedPoiId, setSelectedPoiId] = useState('');
  const [result, setResult] = useState<RankingRunResult | null>(null);
  const autoCalcTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsVersion = useRef(0);

  const { data: pois = [], isLoading: poisLoading } = useQuery({
    queryKey: ['pois', projectId],
    queryFn: () => api.getPois(projectId!),
    enabled: !!projectId,
  });

  const activePoiId = selectedPoiId || pois[0]?.id || '';

  useEffect(() => {
    setSelectedPoiId('');
    setResult(null);
  }, [projectId]);

  useEffect(() => {
    if (pois.length && !pois.some((p) => p.id === selectedPoiId)) {
      setSelectedPoiId(pois[0]?.id ?? '');
    }
  }, [pois, selectedPoiId]);

  const { data: allScenarios = [] } = useQuery({
    queryKey: ['scenarios', projectId],
    queryFn: () => api.getScenarios(projectId!),
    enabled: !!projectId,
  });

  const poiScenarios = useMemo(
    () => allScenarios.filter((s) => s.poi_id === activePoiId),
    [allScenarios, activePoiId]
  );

  const { data: rankingSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['ranking-settings', projectId, activePoiId],
    queryFn: () => api.getPoiRankingSettings(projectId!, activePoiId),
    enabled: !!projectId && !!activePoiId,
  });

  const { data: matrix, isLoading: matrixLoading } = useQuery({
    queryKey: ['ranking-matrix', projectId, activePoiId],
    queryFn: () => api.getPoiRankingMatrix(projectId!, activePoiId),
    enabled: !!projectId && !!activePoiId,
    retry: false,
  });

  const calcMut = useMutation({
    mutationFn: () => api.calculateProjectPoisRanking(projectId!, activePoiId),
    onSuccess: (data) => {
      setResult(data);
      if (data.skipped_pois?.length) {
        pushToast(
          'info',
          `Пропущены POI без анализа: ${data.skipped_pois.join(', ')}`
        );
      }
    },
    onError: (err: Error) => pushToast('error', err.message || 'Не удалось рассчитать ранжирование'),
  });

  const settingsMut = useMutation({
    mutationFn: (data: Partial<RankingSettings>) =>
      api.updatePoiRankingSettings(projectId!, activePoiId, data),
    onSuccess: (data) => {
      queryClient.setQueryData(['ranking-settings', projectId, activePoiId], data);
      settingsVersion.current += 1;
    },
    onError: (err: Error) => pushToast('error', err.message || 'Не удалось сохранить настройки'),
  });

  const scheduleAutoCalculate = useCallback(() => {
    if (!projectId || !activePoiId) return;
    if (autoCalcTimer.current) clearTimeout(autoCalcTimer.current);
    autoCalcTimer.current = setTimeout(() => {
      calcMut.mutate(undefined, { onSuccess: setResult });
    }, 450);
  }, [projectId, activePoiId, calcMut]);

  const calculate = useCallback(
    (opts?: { toast?: boolean }) => {
      if (!activePoiId) return;
      calcMut.mutate(undefined, {
        onSuccess: (data) => {
          setResult(data);
          if (opts?.toast) pushToast('success', 'Ранжирование рассчитано');
        },
      });
    },
    [activePoiId, calcMut, pushToast]
  );

  useEffect(() => {
    if (rankingSettings && !result && !calcMut.isPending) {
      scheduleAutoCalculate();
    }
  }, [rankingSettings, activePoiId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (autoCalcTimer.current) clearTimeout(autoCalcTimer.current);
    };
  }, []);

  const updateSettings = useCallback(
    async (data: Partial<RankingSettings>) => settingsMut.mutateAsync(data),
    [settingsMut]
  );

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['ranking-settings', projectId, activePoiId] });
    queryClient.invalidateQueries({ queryKey: ['ranking-matrix', projectId, activePoiId] });
  }, [queryClient, projectId, activePoiId]);

  const refreshAfterAnalyze = useCallback(async () => {
    if (!projectId || !activePoiId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['scenarios', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['analysis', projectId, activePoiId] }),
      queryClient.invalidateQueries({ queryKey: ['ranking-settings', projectId, activePoiId] }),
      queryClient.invalidateQueries({ queryKey: ['ranking-matrix', projectId, activePoiId] }),
    ]);
    await queryClient.refetchQueries({ queryKey: ['scenarios', projectId] });
    await queryClient.refetchQueries({ queryKey: ['ranking-matrix', projectId, activePoiId] });
  }, [queryClient, projectId, activePoiId]);

  const storedExpertKeys = useMemo(() => new Set<string>(), []);

  const value: RankingContextValue = {
    projectId,
    pois,
    poisLoading,
    activePoiId,
    setSelectedPoiId,
    poiScenarios,
    rankingSettings: rankingSettings ?? {
      algorithm: 'topsis',
      criteria: [],
      weights: {},
      default_expert_values: { ...RANKING_DEFAULT_EXPERT },
      ahp_pairwise: {},
    },
    settingsLoading,
    matrix,
    matrixLoading,
    result,
    calculating: calcMut.isPending,
    calculate,
    updateSettings,
    settingsSaving: settingsMut.isPending,
    storedExpertKeys,
    invalidateAll,
    refreshAfterAnalyze,
  };

  return <RankingContext.Provider value={value}>{children}</RankingContext.Provider>;
}

export function useRankingContext(): RankingContextValue {
  const ctx = useContext(RankingContext);
  if (!ctx) throw new Error('useRankingContext must be used within RankingLayout');
  return ctx;
}
