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
export const PadClusteringLayout = lazy(() =>
  import('../components/layout/PadClusteringLayout').then((m) => ({ default: m.PadClusteringLayout })),
);
export const PadClusteringWorkspacePage = lazy(() =>
  import('../pages/padClustering/PadClusteringWorkspacePage').then((m) => ({
    default: m.PadClusteringWorkspacePage,
  })),
);
export const PadClusteringSummaryPage = lazy(() =>
  import('../pages/padClustering/PadClusteringSummaryPage').then((m) => ({
    default: m.PadClusteringSummaryPage,
  })),
);
export const PadClusteringProfilePage = lazy(() =>
  import('../pages/padClustering/PadClusteringProfilePage').then((m) => ({
    default: m.PadClusteringProfilePage,
  })),
);
export const PadClusteringLegacyRedirect = lazy(() =>
  import('../components/layout/PadClusteringLegacyRedirect').then((m) => ({
    default: m.PadClusteringLegacyRedirect,
  })),
);
/** @deprecated Use PadClusteringWorkspacePage within PadClusteringLayout */
export const PadClusteringPage = PadClusteringWorkspacePage;
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
export const EarthworkParametersPage = lazy(() =>
  import('../pages/EarthworkParametersPage').then((m) => ({ default: m.EarthworkParametersPage })),
);
export const FootprintConnectionsParametersPage = lazy(() =>
  import('../pages/FootprintConnectionsParametersPage').then((m) => ({
    default: m.FootprintConnectionsParametersPage,
  })),
);
export const ParametersLayout = lazy(() =>
  import('../components/layout/ParametersLayout').then((m) => ({ default: m.ParametersLayout })),
);
export const DataLayout = lazy(() =>
  import('../components/layout/DataLayout').then((m) => ({ default: m.DataLayout })),
);
export const DataIndexRedirect = lazy(() =>
  import('../pages/data/DataIndexRedirect').then((m) => ({ default: m.DataIndexRedirect })),
);
