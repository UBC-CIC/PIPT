import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import StudentDashboardPage from './pages/student/StudentDashboardPage';
import InstructorDashboardPage from './pages/instructor/InstructorDashboardPage';
import InstructorSimulationGroupPage from './pages/instructor/InstructorSimulationGroupPage';
import AdminHomePage from './pages/admin/AdminHomePage';
import AdminOrganizationPage from './pages/admin/AdminOrganizationPage';
import AdminSimulationGroupPage from './pages/admin/AdminSimulationGroupPage';
import AdminQuestionBankPage from './pages/admin/AdminQuestionBankPage';
import PatientsPage from './pages/student/PatientsPage';
import PatientDashboardPage from './pages/student/PatientDashboardPage';
import StudentChatPage from './pages/student/StudentChatPage';
import ChatHistoryPage from './pages/student/ChatHistoryPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/instructor" element={<InstructorDashboardPage />} />
        <Route path="/instructor/group/:groupId" element={<InstructorSimulationGroupPage />} />
        <Route path="/admin" element={<AdminHomePage />} />
        <Route path="/admin/organization/:organizationId" element={<AdminOrganizationPage />} />
        <Route path="/admin/organization/:organizationId/question-bank" element={<AdminQuestionBankPage />} />
        <Route path="/admin/organization/:organizationId/group/:groupId" element={<AdminSimulationGroupPage />} />
        <Route path="/student" element={<StudentDashboardPage />} />
        <Route path="/patients/:groupId" element={<PatientsPage />} />
        <Route path="/patients/:groupId/:patientId" element={<PatientDashboardPage />} />
        <Route path="/patients/:groupId/:patientId/chat" element={<StudentChatPage />} />
        <Route path="/patients/:groupId/:patientId/chat/:chatId/history" element={<ChatHistoryPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
