// Initialize Amplify config before anything else
import '@/config/aws-config';

import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import StudentDashboardPage from './pages/student/StudentDashboardPage';
import InstructorDashboardPage from './pages/instructor/InstructorDashboardPage';
import InstructorSimulationGroupPage from './pages/instructor/InstructorSimulationGroupPage';
import AdminHomePage from './pages/admin/AdminHomePage';
import AdminOrganizationPage from './pages/admin/AdminOrganizationPage';
import AdminSimulationGroupPage from './pages/admin/AdminSimulationGroupPage';
import PatientsPage from './pages/student/PatientsPage';
import PatientDashboardPage from './pages/student/PatientDashboardPage';
import StudentChatPage from './pages/student/StudentChatPage';
import ChatHistoryPage from './pages/student/ChatHistoryPage';
import { authService, type AuthUser } from './lib/auth';

// Auth context for sharing auth state across components
interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  refreshUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// Protected route wrapper — redirects to /login if not authenticated
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Role-based dashboard redirect
function DashboardRedirect() {
  const { user } = useAuth();
  
  // Redirect based on user role
  if (user?.groups.includes('instructor')) {
    return <Navigate to="/instructor" replace />;
  } else if (user?.groups.includes('admin')) {
    return <Navigate to="/admin" replace />;
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
    } catch {
      setUser(null);
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
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/" element={<ProtectedRoute><DashboardRedirect /></ProtectedRoute>} />
        <Route path="/instructor" element={<ProtectedRoute><InstructorDashboardPage /></ProtectedRoute>} />
        <Route path="/instructor/group/:groupId" element={<ProtectedRoute><InstructorSimulationGroupPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminHomePage /></ProtectedRoute>} />
        <Route path="/admin/organization/:organizationId" element={<ProtectedRoute><AdminOrganizationPage /></ProtectedRoute>} />
        <Route path="/admin/organization/:organizationId/group/:groupId" element={<ProtectedRoute><AdminSimulationGroupPage /></ProtectedRoute>} />
        <Route path="/student" element={<ProtectedRoute><StudentDashboardPage /></ProtectedRoute>} />
        <Route path="/patients/:groupId" element={<ProtectedRoute><PatientsPage /></ProtectedRoute>} />
        <Route path="/patients/:groupId/:patientId" element={<ProtectedRoute><PatientDashboardPage /></ProtectedRoute>} />
        <Route path="/patients/:groupId/:patientId/chat" element={<ProtectedRoute><StudentChatPage /></ProtectedRoute>} />
        <Route path="/patients/:groupId/:patientId/chat/:chatId/history" element={<ProtectedRoute><ChatHistoryPage /></ProtectedRoute>} />
      </Routes>
    </AuthContext.Provider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
