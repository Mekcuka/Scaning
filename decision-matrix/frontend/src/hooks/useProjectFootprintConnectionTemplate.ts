import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { FootprintLineConnectionTemplate } from '../lib/padFootprintLineAttach';
import {
  loadFootprintConnectionTemplate,
  saveFootprintConnectionTemplate,
} from '../lib/footprintConnectionTemplateStorage';
import { queryKeys } from '../lib/queryKeys';

function normalizeTemplate(raw: unknown): FootprintLineConnectionTemplate {
  if (!raw || typeof raw !== 'object') return {};
  return raw as FootprintLineConnectionTemplate;
}

export function useProjectFootprintConnectionTemplate(projectId: string | null | undefined) {
  const queryClient = useQueryClient();
  const migratedRef = useRef<string | null>(null);

  const query = useQuery({
    queryKey: queryKeys.footprintConnectionTemplate(projectId ?? ''),
    queryFn: async () => {
      const res = await api.getFootprintConnectionTemplate(projectId!);
      return normalizeTemplate(res.template);
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!projectId || query.isLoading || query.isError) return;
    if (migratedRef.current === projectId) return;
    migratedRef.current = projectId;

    const local = loadFootprintConnectionTemplate(projectId);
    const remote = query.data ?? {};
    const remoteEmpty = Object.keys(remote).length === 0;
    const localNonEmpty = Object.keys(local).length > 0;

    if (remoteEmpty && localNonEmpty) {
      void api
        .updateFootprintConnectionTemplate(projectId, local)
        .then((res) => {
          const next = normalizeTemplate(res.template);
          queryClient.setQueryData(queryKeys.footprintConnectionTemplate(projectId), next);
          saveFootprintConnectionTemplate(projectId, next);
        })
        .catch(() => {
          /* keep local fallback */
        });
    } else if (!remoteEmpty) {
      saveFootprintConnectionTemplate(projectId, remote);
    }
  }, [projectId, query.isLoading, query.isError, query.data, queryClient]);

  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const saveMut = useMutation({
    mutationFn: async (template: FootprintLineConnectionTemplate) => {
      if (!projectId) throw new Error('Проект не выбран');
      const res = await api.updateFootprintConnectionTemplate(projectId, template);
      return normalizeTemplate(res.template);
    },
    onSuccess: (template) => {
      if (!projectId) return;
      queryClient.setQueryData(queryKeys.footprintConnectionTemplate(projectId), template);
      saveFootprintConnectionTemplate(projectId, template);
      setLastSavedAt(Date.now());
    },
  });

  const persistTemplate = useCallback(
    (next: FootprintLineConnectionTemplate) => {
      if (!projectId) return;
      queryClient.setQueryData(queryKeys.footprintConnectionTemplate(projectId), next);
      saveFootprintConnectionTemplate(projectId, next);
      saveMut.mutate(next);
    },
    [projectId, queryClient, saveMut],
  );

  const debouncedPersistRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistTemplateDebounced = useCallback(
    (next: FootprintLineConnectionTemplate) => {
      if (!projectId) return;
      queryClient.setQueryData(queryKeys.footprintConnectionTemplate(projectId), next);
      saveFootprintConnectionTemplate(projectId, next);
      if (debouncedPersistRef.current) clearTimeout(debouncedPersistRef.current);
      debouncedPersistRef.current = setTimeout(() => {
        saveMut.mutate(next);
      }, 300);
    },
    [projectId, queryClient, saveMut],
  );

  useEffect(
    () => () => {
      if (debouncedPersistRef.current) clearTimeout(debouncedPersistRef.current);
    },
    [],
  );

  return {
    template: query.data ?? (projectId ? loadFootprintConnectionTemplate(projectId) : {}),
    isLoading: query.isLoading,
    isSaving: saveMut.isPending,
    saveError: saveMut.error instanceof Error ? saveMut.error.message : null,
    lastSavedAt,
    persistTemplate,
    persistTemplateDebounced,
  };
}
