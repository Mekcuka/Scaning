import type { QueryClient } from '@tanstack/react-query';
import { useAppStore } from '../store';

/** Refetch layers/infra/network after import or edits; clears map bbox filter via store nonce. */
export async function refreshMapQueries(queryClient: QueryClient, projectId: string) {
  useAppStore.getState().bumpMapRefresh();
  await queryClient.invalidateQueries({ queryKey: ['layers', projectId] });
  await queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
  await queryClient.refetchQueries({ queryKey: ['layers', projectId] });
  await queryClient.refetchQueries({ queryKey: ['infra', projectId] });
}
