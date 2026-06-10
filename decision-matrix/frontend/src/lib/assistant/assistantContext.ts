import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { useActiveProject } from '../../hooks/useActiveProject';
import { useAppStore } from '../../store';
import type { ChatRequest } from './types';

export function deriveActiveTab(pathname: string): string | null {
  if (pathname === '/map') return 'map';
  if (pathname === '/matrix') return 'matrix';
  if (pathname === '/projects' || pathname === '/') return null;
  if (pathname.startsWith('/projects/')) return 'project-detail';
  if (pathname.startsWith('/parameters/')) return pathname.slice(1);
  if (pathname.startsWith('/flows/')) return pathname.slice(1);
  if (pathname.startsWith('/admin/')) return pathname.slice(1);
  if (pathname.startsWith('/report')) return pathname.slice(1) || 'report';
  return pathname.replace(/^\//, '') || null;
}

export function useAssistantChatContext(): Pick<
  ChatRequest,
  | 'project_id'
  | 'project_name'
  | 'selected_poi_id'
  | 'selected_poi_name'
  | 'active_tab'
  | 'route_path'
> {
  const { pathname } = useLocation();
  const { projectId, activeProject } = useActiveProject();
  const assistantUiContext = useAppStore((s) => s.assistantUiContext);

  return {
    project_id: projectId ?? null,
    project_name: activeProject?.name ?? null,
    selected_poi_id: assistantUiContext.selectedPoiId,
    selected_poi_name: assistantUiContext.selectedPoiName,
    active_tab: deriveActiveTab(pathname),
    route_path: pathname,
  };
}

export function useSyncAssistantUiContext(ctx: {
  selectedPoiId?: string | null;
  selectedPoiName?: string | null;
}): void {
  const setAssistantUiContext = useAppStore((s) => s.setAssistantUiContext);

  useEffect(() => {
    setAssistantUiContext({
      selectedPoiId: ctx.selectedPoiId ?? null,
      selectedPoiName: ctx.selectedPoiName ?? null,
    });
    return () => {
      setAssistantUiContext({ selectedPoiId: null, selectedPoiName: null });
    };
  }, [ctx.selectedPoiId, ctx.selectedPoiName, setAssistantUiContext]);
}
