import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { mapApi } from '../../lib/api';
import { useActiveProject } from '../../hooks/useActiveProject';
import { queryKeys } from '../../lib/queryKeys';
import {
  downloadAllCoordinatesCsv,
  downloadAllCoordinatesExcel,
  downloadPointCoordinatesCsv,
  downloadPointCoordinatesExcel,
  downloadProjectGeoJson,
  filterPointObjects,
  projectExportFilename,
} from '../../lib/projectExport';
import { isLineSubtype } from '../../lib/infraGeometry';
import { useAppStore } from '../../store';

export function useExportPage() {
  const {
    projectId,
    activeProject,
    projects,
    hasProjects,
    isLoading: projectsLoading,
    setProjectId,
  } = useActiveProject();
  const pushToast = useAppStore((s) => s.pushToast);

  const {
    data: infraObjects = [],
    isLoading: infraLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.infra(projectId ?? ''),
    queryFn: () => mapApi.getInfraObjects(projectId!),
    enabled: !!projectId,
  });

  const pointObjects = useMemo(() => filterPointObjects(infraObjects), [infraObjects]);
  const lineCount = useMemo(
    () => infraObjects.filter((obj) => isLineSubtype(obj.subtype)).length,
    [infraObjects],
  );

  const projectName = activeProject?.name ?? 'project';

  const exportPointsExcel = () => {
    downloadPointCoordinatesExcel(
      projectExportFilename(projectName, 'points', 'xlsx'),
      infraObjects,
    );
    pushToast('success', 'Excel с координатами точечных объектов скачан');
  };

  const exportPointsCsv = () => {
    downloadPointCoordinatesCsv(projectExportFilename(projectName, 'points', 'csv'), infraObjects);
    pushToast('success', 'CSV с координатами точечных объектов скачан');
  };

  const exportAllExcel = () => {
    downloadAllCoordinatesExcel(
      projectExportFilename(projectName, 'objects', 'xlsx'),
      infraObjects,
    );
    pushToast('success', 'Excel с координатами всех объектов скачан');
  };

  const exportAllCsv = () => {
    downloadAllCoordinatesCsv(projectExportFilename(projectName, 'objects', 'csv'), infraObjects);
    pushToast('success', 'CSV с координатами всех объектов скачан');
  };

  const exportGeoJson = () => {
    downloadProjectGeoJson(projectExportFilename(projectName, 'geojson', 'geojson'), infraObjects);
    pushToast('success', 'GeoJSON проекта скачан');
  };

  return {
    projectId,
    projectName,
    projects,
    setProjectId,
    hasProjects,
    projectsLoading,
    infraLoading,
    isError,
    error,
    infraObjects,
    pointObjects,
    lineCount,
    exportPointsExcel,
    exportPointsCsv,
    exportAllExcel,
    exportAllCsv,
    exportGeoJson,
  };
}
