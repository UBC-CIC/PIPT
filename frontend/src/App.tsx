// Initialize Amplify config before anything else
import '@/config/aws-config';

import LoadingIndicator from '@/components/LoadingIndicator';
import { NotificationProvider } from '@/components/notifications';
import RoleRoute from '@/components/RoleRoute';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useState, useEffect, createContext, useContext, useCallback, lazy, Suspense } from 'react';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import { authService, type AuthUser } from './lib/auth';

// Lazily loaded pages — route-level code-splitting so each role only downloads
// its own bundle (and heavy deps like recharts/jspdf load on demand).
const StudentDashboardPage = lazy(() => import('./pages/student/StudentDashboardPage'));
const InstructorDashboardPage = lazy(() => import('./pages/instructor/InstructorDashboardPage'));
const InstructorSimulationGroupPage = lazy(() => import('./pages/instructor/InstructorSimulationGroupPage'));
const InstructorConfigurationPage = lazy(() => import('./pages/instructor/InstructorConfigurationPage'));
const InstructorQuestionBankPage = lazy(() => import('./pages/instructor/InstructorQuestionBankPage'));
const AdminHomePage = lazy(() => import('./pages/admin/AdminHomePage'));
const AdminOrganizationPage = lazy(() => import('./pages/admin/AdminOrganizationPage'));
const AdminSimulationGroupPage = lazy(() => import('./pages/admin/AdminSimulationGroupPage'));
const AdminQuestionBankPage = lazy(() => import('./pages/admin/AdminQuestionBankPage'));
const AdminDTPBankPage = lazy(() => import('@/pages/admin/AdminDTPBankPage'));
const AdminRecommendationsBankPage = lazy(() => import('@/pages/admin/AdminRecommendationsBankPage'));
const AdminManageBanksPage = lazy(() => import('@/pages/admin/AdminManageBanksPage'));
const AdminConfigurationPage = lazy(() => import('@/pages/admin/AdminConfigurationPage'));
const PatientsPage = lazy(() => import('./pages/student/PatientsPage'));
const PatientDashboardPage = lazy(() => import('./pages/student/PatientDashboardPage'));
const StudentChatPage = lazy(() => import('./pages/student/StudentChatPage'));
const ChatHistoryPage = lazy(() => import('./pages/student/ChatHistoryPage'));

// Auth context for sharing auth state across components
interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  refreshUser: async () => null,
});

export const useAuth = () => useContext(AuthContext);

// Protected route wrapper — redirects to /login if not authenticated
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  console.log('ProtectedRoute check:', { user, loading, hasUser: !!user });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingIndicator size="lg" message="Loading..." />
      </div>
    );
  }

  if (!user) {
    console.log('ProtectedRoute: No user, redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  console.log('ProtectedRoute: User authenticated, rendering children');
  return <>{children}</>;
}

// Role-based dashboard redirect (admin > instructor > student)
function DashboardRedirect() {
  const { user } = useAuth();
  
  if (user?.groups.includes('admin')) {
    return <Navigate to="/admin" replace />;
  } else if (user?.groups.includes('instructor')) {
    return <Navigate to="/instructor" replace />;
  }
  
  // Default to student dashboard
  return <StudentDashboardPage />;
}

// Inner app component that has access to navigation
function AppRoutes() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      return currentUser;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      await refreshUser();
      setLoading(false);
    };
    checkAuth();
  }, [refreshUser]);

  const handleSignOut = async () => {
    await authService.signOut();
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut: handleSignOut, refreshUser }}>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            <LoadingIndicator size="lg" message="Loading..." />
          </div>
        }
      >
      <Routes>
        <Route path="/" element={<ProtectedRoute><DashboardRedirect /></ProtectedRoute>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/instructor" element={<RoleRoute allowedRoles={['instructor', 'admin']}><InstructorDashboardPage /></RoleRoute>} />
        <Route path="/instructor/group/:groupId" element={<RoleRoute allowedRoles={['instructor', 'admin']}><InstructorSimulationGroupPage /></RoleRoute>} />
        <Route path="/instructor/configuration" element={<RoleRoute allowedRoles={['instructor', 'admin']}><InstructorConfigurationPage /></RoleRoute>} />
        <Route path="/instructor/question-bank" element={<RoleRoute allowedRoles={['instructor', 'admin']}><InstructorQuestionBankPage /></RoleRoute>} />
        <Route path="/admin" element={<RoleRoute allowedRoles={['admin']}><AdminHomePage /></RoleRoute>} />
        <Route path="/admin/organization/:organizationId" element={<RoleRoute allowedRoles={['admin']}><AdminOrganizationPage /></RoleRoute>} />
        <Route path="/admin/organization/:organizationId/banks" element={<RoleRoute allowedRoles={['admin']}><AdminManageBanksPage /></RoleRoute>} />
        <Route path="/admin/organization/:organizationId/question-bank" element={<RoleRoute allowedRoles={['admin']}><AdminQuestionBankPage /></RoleRoute>} />
        <Route path="/admin/organization/:organizationId/dtp-bank" element={<RoleRoute allowedRoles={['admin']}><AdminDTPBankPage /></RoleRoute>} />
        <Route path="/admin/organization/:organizationId/recommendations-bank" element={<RoleRoute allowedRoles={['admin']}><AdminRecommendationsBankPage /></RoleRoute>} />
        <Route path="/admin/organization/:organizationId/configuration" element={<RoleRoute allowedRoles={['admin']}><AdminConfigurationPage /></RoleRoute>} />
        <Route path="/admin/organization/:organizationId/group/:groupId" element={<RoleRoute allowedRoles={['admin']}><AdminSimulationGroupPage /></RoleRoute>} />
        <Route path="/student" element={<ProtectedRoute><StudentDashboardPage /></ProtectedRoute>} />
        <Route path="/patients/:groupId" element={<ProtectedRoute><PatientsPage /></ProtectedRoute>} />
        <Route path="/patients/:groupId/:patientId" element={<ProtectedRoute><PatientDashboardPage /></ProtectedRoute>} />
        <Route path="/patients/:groupId/:patientId/chat" element={<ProtectedRoute><StudentChatPage /></ProtectedRoute>} />
        <Route path="/patients/:groupId/:patientId/chat/:chatId" element={<ProtectedRoute><StudentChatPage /></ProtectedRoute>} />
        <Route path="/patients/:groupId/:patientId/chat/:chatId/history" element={<ProtectedRoute><ChatHistoryPage /></ProtectedRoute>} />
      </Routes>
      </Suspense>
    </AuthContext.Provider>
  );
}

function App() {
  return (
    <NotificationProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </NotificationProvider>
  );
}

export default App;
