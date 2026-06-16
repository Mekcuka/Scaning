import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { useActiveProject } from '../../hooks/useActiveProject';
import { useAppStore } from '../../store';
import type { ChatRequest } from './types';

import { stripProjectPrefix } from '../projectRoutes';

export function deriveActiveTab(pathname: string): string | null {
  const path = stripProjectPrefix(pathname);
  if (path === '/map') return 'map';
  if (path.startsWith('/pad-clustering')) return 'pad-clustering';
  if (path === '/matrix') return 'matrix';
  if (path === '/projects' || path === '/') return null;
  if (path.startsWith('/projects/')) return 'project-detail';
  if (path.startsWith('/parameters/')) return path.slice(1);
  if (path.startsWith('/flows/')) return path.slice(1);
  if (path.startsWith('/admin/')) return path.slice(1);
  if (path.startsWith('/report')) return path.slice(1) || 'report';
  return path.replace(/^\//, '') || null;
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
