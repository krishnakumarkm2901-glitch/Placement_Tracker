import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/ReactToastify.css';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SidebarProvider } from './contexts/SidebarContext';
import AppLayout from './components/layout/AppLayout';
import PublicLayout from './components/layout/PublicLayout';
import ErrorBoundary from './components/feedback/ErrorBoundary';
import { FullPageSpinner } from './components/feedback/LoadingSpinner';

// Lazy load pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const StudentsPage = lazy(() => import('./pages/students/StudentsPage'));
const StudentDetailPage = lazy(() => import('./pages/students/StudentDetailPage'));
const AddStudentPage = lazy(() => import('./pages/students/AddStudentPage'));
const LeetCodeLeaderboardPage = lazy(() => import('./pages/leaderboards/LeetCodeLeaderboardPage'));
const AdminLeaderboardsPage = lazy(() => import('./pages/leaderboards/AdminLeaderboardsPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage'));
const PlatformTrackerPage = lazy(() => import('./pages/trackers/PlatformTrackerPage'));
const StudentPlatformPage = lazy(() => import('./pages/trackers/StudentPlatformPage'));
const NotFoundPage = lazy(() => import('./pages/errors/NotFoundPage'));
const ServerErrorPage = lazy(() => import('./pages/errors/ServerErrorPage'));
const PublicDashboardPage = lazy(() => import('./pages/public/PublicDashboardPage'));
const PublicPlatformPage = lazy(() => import('./pages/public/PublicPlatformPage'));
const PlatformProfileOverviewPage = lazy(() => import('./pages/public/PlatformProfileOverviewPage'));
const AttendancePage = lazy(() => import('./pages/attendance/AttendancePage'));
const StudentAttendancePage = lazy(() => import('./pages/attendance/StudentAttendancePage'));
const DailyTaskReportPage = lazy(() => import('./pages/reports/DailyTaskReportPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  return isAuthenticated ? children : <Navigate to="/loginadmin" replace />;
}

function StudentRoute({ children }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!isAuthenticated) return <Navigate to="/loginadmin" replace />;
  return isAdmin ? <Navigate to="/dashboard" replace /> : children;
}

function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (isAdmin) return children;
  return <Navigate to="/loginadmin" replace />;
}

function HomeRoute() {
  return <DashboardPage />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <SidebarProvider>
              <ErrorBoundary>
                <Suspense fallback={<FullPageSpinner />}>
                  <Routes>
                    {/* Public */}
                    <Route path="/login" element={<Navigate to="/loginadmin" replace />} />
                    <Route path="/loginadmin" element={<LoginPage />} />
                    <Route path="/admin" element={<Navigate to="/loginadmin" replace />} />
                    <Route path="/500" element={<ServerErrorPage />} />

                    <Route element={<PublicLayout />}>
                      <Route index element={<Navigate to="/platform/github" replace />} />
                      <Route path="platform/github" element={<PublicPlatformPage platform="github" />} />
                      <Route path="platform/github/leaderboard" element={<PublicPlatformPage platform="github" />} />
                      <Route path="platform/github/compare" element={<PublicPlatformPage platform="github" />} />
                      <Route path="platform/github/attendance" element={<AttendancePage />} />
                      <Route path="platform/github/profile/:id" element={<StudentDetailPage publicView backPath="/platform/github" />} />
                      <Route path="platform/leetcode" element={<PublicPlatformPage platform="leetcode" />} />
                      <Route path="platform/leetcode/leaderboard" element={<LeetCodeLeaderboardPage />} />
                      <Route path="platform/leetcode/compare" element={<PublicPlatformPage platform="leetcode" />} />
                      <Route path="platform/leetcode/attendance" element={<AttendancePage />} />
                      <Route path="platform/leetcode/profile/:id" element={<PlatformProfileOverviewPage platform="leetcode" />} />
                      <Route path="platform/codechef" element={<PublicPlatformPage platform="codechef" />} />
                      <Route path="platform/codechef/leaderboard" element={<PublicPlatformPage platform="codechef" />} />
                      <Route path="platform/codechef/compare" element={<PublicPlatformPage platform="codechef" />} />
                      <Route path="platform/codechef/attendance" element={<AttendancePage />} />
                      <Route path="platform/codechef/profile/:id" element={<PlatformProfileOverviewPage platform="codechef" />} />
                      <Route path="platform/hackerrank" element={<PublicPlatformPage platform="hackerrank" />} />
                      <Route path="platform/hackerrank/leaderboard" element={<PublicPlatformPage platform="hackerrank" />} />
                      <Route path="platform/hackerrank/compare" element={<PublicPlatformPage platform="hackerrank" />} />
                      <Route path="platform/hackerrank/attendance" element={<AttendancePage />} />
                      <Route path="platform/hackerrank/profile/:id" element={<PlatformProfileOverviewPage platform="hackerrank" />} />
                      <Route path="leaderboard" element={<PublicDashboardPage />} />
                      <Route path="compare" element={<PublicDashboardPage />} />
                      <Route path="profile/:id" element={<StudentDetailPage publicView />} />
                    </Route>

                    {/* Protected — with layout */}
                    <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                      <Route path="dashboard" element={<AdminRoute><HomeRoute /></AdminRoute>} />
                      <Route path="students" element={<AdminRoute><StudentsPage /></AdminRoute>} />
                      <Route path="students/add" element={<AdminRoute><AddStudentPage /></AdminRoute>} />
                      <Route path="students/:id" element={<StudentDetailPage />} />
                      <Route path="github-tracker" element={<AdminRoute><PlatformTrackerPage platform="github" /></AdminRoute>} />
                      <Route path="github-tracker/:id" element={<AdminRoute><StudentDetailPage backPath="/github-tracker" /></AdminRoute>} />
                      <Route path="leetcode" element={<AdminRoute><PlatformTrackerPage platform="leetcode" /></AdminRoute>} />
                      <Route path="leetcode/:id" element={<AdminRoute><PlatformProfileOverviewPage platform="leetcode" /></AdminRoute>} />
                      <Route path="codechef" element={<AdminRoute><PlatformTrackerPage platform="codechef" /></AdminRoute>} />
                      <Route path="codechef/:id" element={<AdminRoute><PlatformProfileOverviewPage platform="codechef" /></AdminRoute>} />
                      <Route path="hackerrank" element={<AdminRoute><PlatformTrackerPage platform="hackerrank" /></AdminRoute>} />
                      <Route path="hackerrank/:id" element={<AdminRoute><PlatformProfileOverviewPage platform="hackerrank" /></AdminRoute>} />
                      <Route path="students/:id/platform/:platform" element={<AdminRoute><PlatformProfileOverviewPage /></AdminRoute>} />
                      <Route path="leaderboards" element={<AdminRoute><AdminLeaderboardsPage /></AdminRoute>} />
                      <Route path="reports" element={<AdminRoute><ReportsPage /></AdminRoute>} />
                      <Route path="notifications" element={<AdminRoute><NotificationsPage /></AdminRoute>} />
                      <Route path="attendance" element={<AdminRoute><AttendancePage /></AdminRoute>} />
                      <Route path="daily-task-report" element={<AdminRoute><DailyTaskReportPage /></AdminRoute>} />
                      <Route path="student" element={<StudentRoute><StudentPlatformPage platform="github" /></StudentRoute>} />
                      <Route path="student/leaderboard" element={<StudentRoute><LeetCodeLeaderboardPage /></StudentRoute>} />
                      <Route path="student/compare" element={<StudentRoute><PublicDashboardPage /></StudentRoute>} />
                      <Route path="student/github" element={<StudentRoute><StudentPlatformPage platform="github" /></StudentRoute>} />
                      <Route path="student/leetcode" element={<StudentRoute><StudentPlatformPage platform="leetcode" /></StudentRoute>} />
                      <Route path="student/codechef" element={<StudentRoute><StudentPlatformPage platform="codechef" /></StudentRoute>} />
                      <Route path="student/hackerrank" element={<StudentRoute><StudentPlatformPage platform="hackerrank" /></StudentRoute>} />
                      <Route path="student/attendance" element={<StudentRoute><StudentAttendancePage /></StudentRoute>} />
                    </Route>

                    {/* 404 */}
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </Suspense>
                <ToastContainer
                  position="bottom-right"
                  autoClose={4000}
                  hideProgressBar={false}
                  newestOnTop
                  closeOnClick
                  rtl={false}
                  pauseOnFocusLoss
                  draggable
                  pauseOnHover
                  theme="colored"
                  toastClassName="!rounded-xl !shadow-lg"
                />
              </ErrorBoundary>
            </SidebarProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
