import { BrowserRouter, Routes, Route } from 'react-router-dom';
import StudentDashboardPage from './pages/student/StudentDashboardPage';
import PatientsPage from './pages/student/PatientsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StudentDashboardPage />} />
        <Route path="/patients/:groupId" element={<PatientsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
