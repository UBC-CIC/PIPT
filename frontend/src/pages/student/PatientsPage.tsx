import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import UserAvatar from '@/components/UserAvatar';
import { mockDataService } from '@/services/studentService';
import { ArrowLeft } from 'lucide-react';

/**
 * PatientsPage Component
 * 
 * Displays a list of patients for a specific simulation group.
 * Shows patient name, avatar placeholder, evaluation statuses, and review button.
 */
function PatientsPage() {
  const navigate = useNavigate();
  const { groupId } = useParams();
  
  // Load user data from mock data service
  const user = mockDataService.getCurrentUser();
  
  // Load patients from mock data service
  const patients = mockDataService.getPatients();

  /**
   * Handle sign out event
   */
  const handleSignOut = () => {
    navigate('/login');
  };

  /**
   * Handle back to home navigation
   */
  const handleBackToHome = () => {
    navigate('/');
  };

  /**
   * Handle review button click
   */
  const handleReview = (patientId: string) => {
    navigate(`/patients/${groupId}/${patientId}`);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="flex bg-gray-200 border-b border-border items-center justify-between py-6 px-8">
        <div className="flex items-center gap-4">
          <UserAvatar
            name={user.name}
            imageUrl={user.avatarUrl}
            size="medium"
          />
          <div className="flex flex-col items-start gap-0.5">
            <h1 className="font-bold tracking-tight text-gray-900 leading-tight text-2xl">
              Patients
            </h1>
            <button
              onClick={handleBackToHome}
              className="text-gray-600 hover:text-gray-900 font-normal text-sm flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home Page
            </button>
          </div>
        </div>

        <div className="flex items-center">
          <Button
            variant="default"
            onClick={handleSignOut}
            className="bg-gray-800 text-white hover:bg-gray-900 px-6"
          >
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-8 py-6">
        <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-300">
              <tr>
                <th className="px-6 py-4 text-center font-semibold text-gray-900">Patient</th>
                <th className="px-6 py-4 text-center font-semibold text-gray-900">LLM Evaluation</th>
                <th className="px-6 py-4 text-center font-semibold text-gray-900">Review</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr
                  key={patient.id}
                  className="border-b border-gray-200 last:border-b-0"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 justify-center">
                      <UserAvatar
                        name={patient.name}
                        imageUrl={patient.avatarUrl}
                        size="small"
                      />
                      <span className="text-gray-900">{patient.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-center">{patient.llmEvaluation}</td>
                  <td className="px-6 py-4 text-center">
                    <Button
                      onClick={() => handleReview(patient.id)}
                      variant="default"
                      className="bg-gray-800 text-white hover:bg-gray-900 px-6"
                    >
                      Review
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default PatientsPage;
