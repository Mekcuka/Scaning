import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleProtectedRoute } from './components/RoleProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { DashboardPage } from './pages/DashboardPage';
import { MapPage } from './pages/MapPage';
import { ImportPage } from './pages/ImportPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { RatesPage } from './pages/RatesPage';
import { MatrixPage } from './pages/MatrixPage';
import { ReportListPage } from './pages/report/ReportListPage';
import { ReportNewPage, ReportDetailPage } from './pages/report/ReportDetailPage';
import { FlowSchematicLayout } from './pages/flows/FlowSchematicLayout';
import { FlowsIndexRedirect } from './pages/flows/FlowsIndexRedirect';
import { FlowTechnologyPage } from './pages/flows/FlowTechnologyPage';
import { FlowEconomicPage } from './pages/flows/FlowEconomicPage';
import { FlowLogisticsPage } from './pages/flows/FlowLogisticsPage';
import { ParametersPage } from './pages/ParametersPage';
import { SandParametersPage } from './pages/SandParametersPage';
import { EntryDatesParametersPage } from './pages/EntryDatesParametersPage';
import { ParametersLayout } from './components/layout/ParametersLayout';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

export default function App() {
  return (
    <div className="app-viewport">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
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
              <Route element={<RoleProtectedRoute roles={['admin']} />}>
                <Route path="/admin" element={<AdminUsersPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
    </div>
  );
}
