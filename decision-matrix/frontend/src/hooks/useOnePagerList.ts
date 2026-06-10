import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  defaultOnePagerListApi,
  type OnePagerListApiPort,
} from '../lib/api';
import { downloadBlob } from '../lib/mapSnapshot';
import { useAppStore } from '../store';

export type UseOnePagerListOptions = {
  onePagerApi?: OnePagerListApiPort;
};

export function useOnePagerList(
  projectId: string | null | undefined,
  options: UseOnePagerListOptions = {},
) {
  const onePagerApi = options.onePagerApi ?? defaultOnePagerListApi;
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);

  const listQuery = useQuery({
    queryKey: ['one-pagers', projectId],
    queryFn: () => onePagerApi.getOnePagers(projectId!),
    enabled: !!projectId,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => onePagerApi.deleteOnePager(projectId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['one-pagers', projectId] });
      pushToast('success', 'Отчёт удалён');
    },
    onError: (e: Error) => pushToast('error', e.message),
  });

  const pptxMut = useMutation({
    mutationFn: (reportId: string) => onePagerApi.exportOnePagerPptx(projectId!, reportId),
    onSuccess: (blob, reportId) => {
      downloadBlob(blob, `one-pager-${reportId.slice(0, 8)}.pptx`);
      queryClient.invalidateQueries({ queryKey: ['one-pagers', projectId] });
      pushToast('success', 'PPTX скачан');
    },
    onError: (e: Error) => pushToast('error', e.message),
  });

  return {
    reports: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    deleteMut,
    pptxMut,
  };
}
