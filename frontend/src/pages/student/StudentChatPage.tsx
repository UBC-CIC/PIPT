import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import UserAvatar from '@/components/UserAvatar';
import { mockDataService } from '@/services/studentService';
import { ArrowLeft, Mic, Send } from 'lucide-react';

/**
 * StudentChatPage Component
 * 
 * Interactive chat interface for medical simulation with AI patient.
 */
function StudentChatPage() {
  const navigate = useNavigate();
  const { groupId, patientId } = useParams();
  
  // Load user data from mock data service
  const user = mockDataService.getCurrentUser();
  
  // Mock patient data
  const patient = {
    id: patientId,
    name: 'Pamela',
    age: 56,
    gender: 'Female',
  };

  /**
   * Handle sign out event
   */
  const handleSignOut = () => {
    navigate('/login');
  };

  /**
   * Handle back to patient dashboard
   */
  const handleBackToPatientDashboard = () => {
    navigate(`/patients/${groupId}/${patientId}`);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
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
              AI Patient
            </h1>
            <button
              onClick={handleBackToPatientDashboard}
              className="text-gray-600 hover:text-gray-900 font-normal text-sm flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Patient Dashboard
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
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-300 flex flex-col">
          {/* Patient Info */}
          <div className="p-6 border-b border-gray-300">
            <h2 className="font-semibold text-lg text-gray-900 mb-1">{patient.name}</h2>
            <p className="text-sm text-gray-600">{patient.gender}, {patient.age} years old</p>
          </div>

          {/* Spacer */}
          <div className="flex-1"></div>

          {/* Sidebar Buttons */}
          <div className="flex flex-col gap-3 p-4">
            <Button
              variant="outline"
              className="w-full justify-center bg-gray-800 text-white hover:bg-gray-900 border-gray-800"
            >
              Case Materials
            </Button>
            <Button
              variant="outline"
              className="w-full justify-center bg-gray-800 text-white hover:bg-gray-900 border-gray-800"
            >
              Notes
            </Button>
            <Button
              variant="outline"
              className="w-full justify-center bg-gray-800 text-white hover:bg-gray-900 border-gray-800"
            >
              Patient Information
            </Button>
            <Button
              variant="outline"
              className="w-full justify-center bg-gray-800 text-white hover:bg-gray-900 border-gray-800"
            >
              Reveal Answer
            </Button>
            <Button
              variant="outline"
              className="w-full justify-center text-white hover:opacity-90 border-0"
              style={{ backgroundColor: '#E74C3C' }}
            >
              Conclude Interaction
            </Button>
          </div>
        </aside>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Chat Messages Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Chat messages will be rendered here */}
          </div>

          {/* Message Input Area */}
          <div className="border-t border-gray-300 p-6">
            <div className="flex items-center gap-3">
              <button
                className="p-3 rounded-full bg-gray-800 text-white hover:bg-gray-900 transition-colors"
                aria-label="Voice input"
              >
                <Mic className="w-5 h-5" />
              </button>
              
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Type your message..."
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-gray-800 text-white hover:bg-gray-900 transition-colors"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StudentChatPage;
