import { lazy } from 'react';
import { PageSkeleton } from '../components/PageSkeleton';

export function RouteFallback() {
  return <PageSkeleton lines={5} />;
}

export const LoginPage = lazy(() => import('../pages/LoginPage').then((m) => ({ default: m.LoginPage })));
export const RegisterPage = lazy(() => import('../pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
export const AdminUsersPage = lazy(() => import('../pages/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })));
export const AdminJobsPage = lazy(() => import('../pages/AdminJobsPage').then((m) => ({ default: m.AdminJobsPage })));
export const AdminAssistantPage = lazy(() =>
  import('../pages/AdminAssistantPage').then((m) => ({ default: m.AdminAssistantPage })),
);
export const AdminLayout = lazy(() =>
  import('../components/layout/AdminLayout').then((m) => ({ default: m.AdminLayout })),
);
export const DashboardPage = lazy(() => import('../pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
export const MapPage = lazy(() => import('../pages/MapPage').then((m) => ({ default: m.MapPage })));
export const ImportPage = lazy(() => import('../pages/ImportPage').then((m) => ({ default: m.ImportPage })));
export const ExportPage = lazy(() => import('../pages/ExportPage').then((m) => ({ default: m.ExportPage })));
export const Import3DPage = lazy(() =>
  import('../pages/Import3DPage').then((m) => ({ default: m.Import3DPage })),
);
export const ProjectsPage = lazy(() => import('../pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })));
export const ProjectDetailPage = lazy(() =>
  import('../pages/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage })),
);
export const RatesPage = lazy(() => import('../pages/RatesPage').then((m) => ({ default: m.RatesPage })));
export const MatrixPage = lazy(() => import('../pages/MatrixPage').then((m) => ({ default: m.MatrixPage })));
export const ReportListPage = lazy(() =>
  import('../pages/report/ReportListPage').then((m) => ({ default: m.ReportListPage })),
);
export const ReportNewPage = lazy(() =>
  import('../pages/report/ReportDetailPage').then((m) => ({ default: m.ReportNewPage })),
);
export const ReportDetailPage = lazy(() =>
  import('../pages/report/ReportDetailPage').then((m) => ({ default: m.ReportDetailPage })),
);
export const FlowSchematicLayout = lazy(() =>
  import('../pages/flows/FlowSchematicLayout').then((m) => ({ default: m.FlowSchematicLayout })),
);
export const FlowsIndexRedirect = lazy(() =>
  import('../pages/flows/FlowsIndexRedirect').then((m) => ({ default: m.FlowsIndexRedirect })),
);
export const FlowTechnologyPage = lazy(() =>
  import('../pages/flows/FlowTechnologyPage').then((m) => ({ default: m.FlowTechnologyPage })),
);
export const FlowEconomicPage = lazy(() =>
  import('../pages/flows/FlowEconomicPage').then((m) => ({ default: m.FlowEconomicPage })),
);
export const FlowLogisticsPage = lazy(() =>
  import('../pages/flows/FlowLogisticsPage').then((m) => ({ default: m.FlowLogisticsPage })),
);
export const ParametersPage = lazy(() =>
  import('../pages/ParametersPage').then((m) => ({ default: m.ParametersPage })),
);
export const SandParametersPage = lazy(() =>
  import('../pages/SandParametersPage').then((m) => ({ default: m.SandParametersPage })),
);
export const EntryDatesParametersPage = lazy(() =>
  import('../pages/EntryDatesParametersPage').then((m) => ({ default: m.EntryDatesParametersPage })),
);
export const ParametersLayout = lazy(() =>
  import('../components/layout/ParametersLayout').then((m) => ({ default: m.ParametersLayout })),
);
