import { projectsApi } from '../projectsApi';

/** Narrow projects API for listing and resolving active project. */
export type ProjectsListApiPort = Pick<typeof projectsApi, 'projects'>;

/** Narrow projects API for POI queries. */
export type ProjectsDataApiPort = Pick<typeof projectsApi, 'getPois'>;

export const defaultProjectsListApi: ProjectsListApiPort = projectsApi;
export const defaultProjectsDataApi: ProjectsDataApiPort = projectsApi;
