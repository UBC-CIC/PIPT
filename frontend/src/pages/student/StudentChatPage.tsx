import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import UserAvatar from '@/components/UserAvatar';
import { mockDataService } from '@/services/studentService';
import { ArrowLeft, Mic, Send, FileText, StickyNote, User, Eye, CheckCircle } from 'lucide-react';
import { SIMULATION_GROUP_COLOR_PALETTE } from '@/lib/colors';
import { useState, useRef, useEffect } from 'react';
import CaseMaterialsDialog from '@/components/CaseMaterialsDialog';
import NotesDialog from '@/components/NotesDialog';
import PatientInformationDialog from '@/components/PatientInformationDialog';
import ConfirmRevealDialog from '@/components/ConfirmRevealDialog';
import AnswerKeyDialog from '@/components/AnswerKeyDialog';

// Message interface matching database schema
interface Message {
  message_id: string;
  chat_id: string;
  student_sent: boolean;
  message_content: string;
  time_sent: string;
  quality_score?: number;
  quality_feedback?: string;
  suggested_rewrite?: string;
}

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
    imageUrl: undefined as string | undefined,
    // Future: Add patient image URL from backend
    // imageUrl: 'https://s3.amazonaws.com/bucket/patients/pamela.jpg',
  };

  // State for dialogs
  const [isCaseMaterialsOpen, setIsCaseMaterialsOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isPatientInfoOpen, setIsPatientInfoOpen] = useState(false);
  const [isConfirmRevealOpen, setIsConfirmRevealOpen] = useState(false);
  const [isAnswerKeyOpen, setIsAnswerKeyOpen] = useState(false);

  // State for chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatId = `chat-${groupId}-${patientId}`; // Mock chat ID

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mock case materials data - will be replaced with backend data
  const caseMaterials = [
    {
      id: '1',
      title: 'Initial Triage Vital Signs',
      description: 'Recorded upon arrival to clinic.',
      type: 'image' as const,
    },
    {
      id: '2',
      title: '12-Lead Electrocardiogram (ECG)',
      description: 'Standard 12-lead ECG performed during assessment to evaluate cardiac rhythm and possible ischemic changes.',
      type: 'image' as const,
    },
    {
      id: '3',
      title: 'Lung Auscultation Recording',
      description: 'Audio recording of lung sounds to evaluate respiratory status.',
      type: 'video' as const,
    },
  ];

  // Mock patient information files - will be replaced with S3 data
  const patientFiles = [
    {
      id: '1',
      filename: 'Patient_Information_Upload_Pamela.pdf',
      description: 'No description available',
      // Future S3 integration:
      // s3Key: 'patients/123/Patient_Information_Upload_Pamela.pdf',
      // s3Url: 'https://bucket.s3.amazonaws.com/...',
    },
  ];

  // Mock answer key - will be replaced with S3 data
  const answerKey = {
    id: '1',
    title: `${patient.name} - Answer Key`,
    description: 'Complete diagnosis and treatment plan for this patient case.',
    // Future S3 integration:
    // s3Key: 'answer-keys/pamela-answer-key.pdf',
    // s3Url: 'https://bucket.s3.amazonaws.com/...',
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

  /**
   * Handle reveal answer confirmation
   */
  const handleRevealAnswer = () => {
    console.log('Revealing answer...');
    setIsConfirmRevealOpen(false);
    setIsAnswerKeyOpen(true);
  };

  /**
   * Handle sending a message
   */
  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    // Create student message
    const studentMessage: Message = {
      message_id: `msg-${Date.now()}`,
      chat_id: chatId,
      student_sent: true,
      message_content: inputMessage,
      time_sent: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, studentMessage]);
    setInputMessage('');

    // Simulate AI response after a delay (remove when backend is ready)
    setTimeout(() => {
      const aiMessage: Message = {
        message_id: `msg-${Date.now()}`,
        chat_id: chatId,
        student_sent: false,
        message_content: 'Thank you for your question. I\'m the AI patient simulation.',
        time_sent: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    }, 1000);
  };

  /**
   * Handle Enter key press
   */
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  /**
   * Format timestamp for display
   */
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Case Materials Dialog */}
      <CaseMaterialsDialog
        isOpen={isCaseMaterialsOpen}
        onClose={() => setIsCaseMaterialsOpen(false)}
        materials={caseMaterials}
      />

      {/* Notes Dialog */}
      <NotesDialog
        isOpen={isNotesOpen}
        onClose={() => setIsNotesOpen(false)}
      />

      {/* Patient Information Dialog */}
      <PatientInformationDialog
        isOpen={isPatientInfoOpen}
        onClose={() => setIsPatientInfoOpen(false)}
        files={patientFiles}
      />

      {/* Confirm Reveal Dialog */}
      <ConfirmRevealDialog
        isOpen={isConfirmRevealOpen}
        onCancel={() => setIsConfirmRevealOpen(false)}
        onConfirm={handleRevealAnswer}
      />

      {/* Answer Key Dialog */}
      <AnswerKeyDialog
        isOpen={isAnswerKeyOpen}
        onClose={() => setIsAnswerKeyOpen(false)}
        answerKey={answerKey}
      />

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
              className="w-full justify-start bg-gray-800 text-white hover:bg-gray-900 border-gray-800"
              onClick={() => setIsCaseMaterialsOpen(true)}
            >
              <FileText className="w-5 h-5 mr-2" />
              Case Materials
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start bg-gray-800 text-white hover:bg-gray-900 border-gray-800"
              onClick={() => setIsNotesOpen(true)}
            >
              <StickyNote className="w-5 h-5 mr-2" />
              Notes
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start bg-gray-800 text-white hover:bg-gray-900 border-gray-800"
              onClick={() => setIsPatientInfoOpen(true)}
            >
              <User className="w-5 h-5 mr-2" />
              Patient Information
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-white hover:opacity-90 border-0"
              style={{ backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[5] }}
              onClick={() => setIsConfirmRevealOpen(true)}
            >
              <Eye className="w-5 h-5 mr-2" />
              Reveal Answer
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-white hover:opacity-90 border-0"
              style={{ backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[6] }}
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Conclude Interaction
            </Button>
          </div>
        </aside>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Chat Messages Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p>Start a conversation with the AI patient...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.message_id}
                    className={`flex gap-3 ${message.student_sent ? 'justify-end' : 'justify-start'}`}
                  >
                    {/* Avatar for AI patient (left side) */}
                    {!message.student_sent && (
                      <div className="flex-shrink-0">
                        <UserAvatar
                          name={patient.name}
                          imageUrl={patient.imageUrl}
                          size="small"
                        />
                      </div>
                    )}

                    {/* Message bubble */}
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-3 ${
                        message.student_sent ? 'rounded-br-none' : 'rounded-bl-none'
                      }`}
                      style={{
                        backgroundColor: message.student_sent
                          ? SIMULATION_GROUP_COLOR_PALETTE[2]
                          : '#F3F4F6',
                        color: message.student_sent ? '#FFFFFF' : '#111827',
                      }}
                    >
                      <p className="text-sm leading-relaxed">{message.message_content}</p>
                      <p
                        className="text-xs mt-1"
                        style={{
                          color: message.student_sent ? '#FFFFFF' : '#6B7280',
                          opacity: message.student_sent ? 0.8 : 1,
                        }}
                      >
                        {formatTime(message.time_sent)}
                      </p>
                    </div>

                    {/* Avatar for student (right side) */}
                    {message.student_sent && (
                      <div className="flex-shrink-0">
                        <UserAvatar
                          name={user.name}
                          imageUrl={user.avatarUrl}
                          size="small"
                        />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
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
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
                <button
                  onClick={handleSendMessage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-gray-800 text-white hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Send message"
                  disabled={!inputMessage.trim()}
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
