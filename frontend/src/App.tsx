import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import StudentDashboardPage from './pages/student/StudentDashboardPage';
import PatientsPage from './pages/student/PatientsPage';
import PatientDashboardPage from './pages/student/PatientDashboardPage';
import StudentChatPage from './pages/student/StudentChatPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/" element={<StudentDashboardPage />} />
        <Route path="/patients/:groupId" element={<PatientsPage />} />
        <Route path="/patients/:groupId/:patientId" element={<PatientDashboardPage />} />
        <Route path="/patients/:groupId/:patientId/chat" element={<StudentChatPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
