import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleProtectedRoute } from './components/RoleProtectedRoute';
import { RouteFallback } from './routes/lazyPages';
import {
  AdminJobsPage,
  AdminLayout,
  AdminUsersPage,
  DashboardPage,
  EntryDatesParametersPage,
  FlowEconomicPage,
  FlowLogisticsPage,
  FlowSchematicLayout,
  FlowTechnologyPage,
  FlowsIndexRedirect,
  ImportPage,
  Import3DPage,
  LoginPage,
  MapPage,
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
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/map" element={<MapPage />} />
                  <Route path="/parameters" element={<ParametersLayout />}>
                    <Route index element={<Navigate to="capacity" replace />} />
                    <Route path="capacity" element={<ParametersPage />} />
                    <Route path="sand" element={<SandParametersPage />} />
                    <Route path="entry-dates" element={<EntryDatesParametersPage />} />
                    <Route path="rates" element={<RatesPage />} />
                  </Route>
                  <Route path="/rates" element={<Navigate to="/parameters/rates" replace />} />
                  <Route element={<RoleProtectedRoute roles={['admin', 'analyst', 'data_manager']} />}>
                    <Route path="/import" element={<ImportPage />} />
                  </Route>
                  <Route path="/projects" element={<ProjectsPage />} />
                  <Route path="/projects/:id" element={<ProjectDetailPage />} />
                  <Route path="/matrix" element={<MatrixPage />} />
                  <Route path="/report" element={<ReportListPage />} />
                  <Route path="/report/new" element={<ReportNewPage />} />
                  <Route path="/report/:id" element={<ReportDetailPage />} />
                  <Route path="/flows" element={<FlowSchematicLayout />}>
                    <Route index element={<FlowsIndexRedirect />} />
                    <Route path="technology" element={<FlowTechnologyPage />} />
                    <Route path="economic" element={<FlowEconomicPage />} />
                    <Route path="logistics" element={<FlowLogisticsPage />} />
                  </Route>
                  <Route path="/import-3d" element={<Import3DPage />} />
                  <Route element={<RoleProtectedRoute roles={['admin']} />}>
                    <Route path="/admin" element={<AdminLayout />}>
                      <Route index element={<Navigate to="/admin/users" replace />} />
                      <Route path="users" element={<AdminUsersPage />} />
                      <Route path="jobs" element={<AdminJobsPage />} />
                    </Route>
                  </Route>
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
