import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppLayout } from './components/layout/AppLayout';
import {
  LegacyPathPreserveRedirect,
  LegacyPrefixRedirect,
  LegacyProjectRedirect,
} from './components/layout/LegacyProjectRedirect';
import { ProjectRouteLayout } from './components/layout/ProjectRouteLayout';
import { SectionIndexRedirect } from './components/layout/SectionIndexRedirect';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleProtectedRoute } from './components/RoleProtectedRoute';
import { RouteFallback } from './routes/lazyPages';
import {
  AdminJobsPage,
  AdminAssistantPage,
  AdminLayout,
  AdminUsersPage,
  DashboardPage,
  EntryDatesParametersPage,
  EarthworkParametersPage,
  FootprintConnectionsParametersPage,
  FlowEconomicPage,
  FlowLogisticsPage,
  FlowSchematicLayout,
  FlowTechnologyPage,
  FlowsIndexRedirect,
  ImportPage,
  ExportPage,
  Import3DPage,
  DataLayout,
  DataIndexRedirect,
  LoginPage,
  MapPage,
  PadClusteringPage,
  MatrixPage,
  ParametersLayout,
  ParametersPage,
  ProjectDetailPage,
  ProjectsPage,
  RatesPage,
  RegisterPage,
  ReportDetailPage,
  ReportListPage,
  ReportNewPage,
  SandParametersPage,
} from './routes/lazyPages';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function ProjectRoutes() {
  return (
    <Route element={<ProjectRouteLayout />}>
      <Route path="/dashboard/:projectId" element={<DashboardPage />} />
      <Route path="/map/:projectId" element={<MapPage />} />
      <Route path="/pad-clustering/:projectId" element={<PadClusteringPage />} />
      <Route path="/matrix/:projectId" element={<MatrixPage />} />

      <Route path="/parameters" element={<ParametersLayout />}>
        <Route path="capacity/:projectId" element={<ParametersPage />} />
        <Route path="sand/:projectId" element={<SandParametersPage />} />
        <Route path="earthwork/:projectId" element={<EarthworkParametersPage />} />
        <Route path="footprint-connections/:projectId" element={<FootprintConnectionsParametersPage />} />
        <Route path="entry-dates/:projectId" element={<EntryDatesParametersPage />} />
        <Route path="rates/:projectId" element={<RatesPage />} />
        <Route path=":projectId" element={<SectionIndexRedirect section="parameters" />} />
      </Route>

      <Route path="/data" element={<DataLayout />}>
        <Route element={<RoleProtectedRoute roles={['admin', 'analyst', 'data_manager']} />}>
          <Route path="import/:projectId" element={<ImportPage />} />
        </Route>
        <Route path="export/:projectId" element={<ExportPage />} />
        <Route path="import-3d/:projectId" element={<Import3DPage />} />
        <Route path=":projectId" element={<DataIndexRedirect />} />
      </Route>

      <Route path="/report/new/:projectId" element={<ReportNewPage />} />
      <Route path="/report/:id/:projectId" element={<ReportDetailPage />} />
      <Route path="/report/:projectId" element={<ReportListPage />} />

      <Route path="/flows" element={<FlowSchematicLayout />}>
        <Route path="technology/:projectId" element={<FlowTechnologyPage />} />
        <Route path="economic/:projectId" element={<FlowEconomicPage />} />
        <Route path="logistics/:projectId" element={<FlowLogisticsPage />} />
        <Route path=":projectId" element={<FlowsIndexRedirect />} />
      </Route>
    </Route>
  );
}

function AppRoutes() {
  const location = useLocation();

  return (
    <ErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />

              {/* Bare legacy URLs → /section/{projectId} */}
              <Route path="/" element={<LegacyProjectRedirect />} />
              <Route path="/map" element={<LegacyProjectRedirect suffix="/map" />} />
              <Route path="/pad-clustering" element={<LegacyProjectRedirect suffix="/pad-clustering" />} />
              <Route path="/matrix" element={<LegacyProjectRedirect suffix="/matrix" />} />
              <Route path="/report/new" element={<LegacyProjectRedirect suffix="/report/new" />} />
              <Route path="/report/:reportId" element={<LegacyPathPreserveRedirect />} />
              <Route path="/report" element={<LegacyProjectRedirect suffix="/report" />} />
              <Route path="/parameters/*" element={<LegacyPathPreserveRedirect />} />
              <Route path="/flows/*" element={<LegacyPathPreserveRedirect />} />
              <Route path="/data/*" element={<LegacyPathPreserveRedirect />} />
              <Route path="/rates" element={<LegacyProjectRedirect suffix="/parameters/rates" />} />
              <Route path="/import" element={<LegacyProjectRedirect suffix="/data/import" />} />
              <Route path="/export" element={<LegacyProjectRedirect suffix="/data/export" />} />
              <Route path="/import-3d" element={<LegacyProjectRedirect suffix="/data/import-3d" />} />

              <Route element={<RoleProtectedRoute roles={['admin']} />}>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<SectionIndexRedirect section="admin" />} />
                  <Route path="users" element={<AdminUsersPage />} />
                  <Route path="jobs" element={<AdminJobsPage />} />
                  <Route path="assistant" element={<AdminAssistantPage />} />
                </Route>
              </Route>

              {ProjectRoutes()}

              {/* Legacy /{projectId}/… → /…/{projectId} */}
              <Route path="/:projectId/*" element={<LegacyPrefixRedirect />} />
              <Route path="/:projectId" element={<LegacyPrefixRedirect />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <div className="app-viewport">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <AppRoutes />
        </BrowserRouter>
      </QueryClientProvider>
    </div>
  );
}
