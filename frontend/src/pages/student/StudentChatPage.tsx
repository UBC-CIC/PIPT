import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import PageContainer from '@/components/PageContainer';
import UserAvatar from '@/components/UserAvatar';
import { mockDataService, type StudentChatMessage as Message } from '@/services/studentService';
import { ArrowLeft, Mic, Send, FileText, User, CheckCircle, X, Menu, Stethoscope, Flag, ChevronRight, ChevronLeft } from 'lucide-react';
import { SIMULATION_GROUP_COLOR_PALETTE, UI_COLORS } from '@/lib/colors';
import { useState, useRef, useEffect, useMemo } from 'react';
// CaseMaterialsDialog and PhysicalAssessmentDialog are rendered inline in the sidebar
import PatientInformationDialog from '@/components/PatientInformationDialog';
import ConfirmConcludeDialog from '@/components/ConfirmConcludeDialog';
import ReportIssueDialog from '@/components/ReportIssueDialog';

/**
 * StudentChatPage Component
 * 
 * Interactive chat interface for medical simulation with AI patient.
 */
function StudentChatPage() {
  const navigate = useNavigate();
  const { groupId, patientId } = useParams();
  
  // Load user data from auth context
  const { user: authUser } = useAuth();
  const user = { name: authUser?.email || 'Student', avatarUrl: undefined };
  
  // Load patient data from mock data service
  const patient = mockDataService.getPatientDetail(patientId);

  // Load case materials from mock data service
  const caseMaterials = mockDataService.getCaseMaterials();

  // Load patient files from mock data service
  const patientFiles = mockDataService.getPatientFiles();

  // State for dialogs
  const [isPatientInfoOpen, setIsPatientInfoOpen] = useState(false);
  const [isConfirmConcludeOpen, setIsConfirmConcludeOpen] = useState(false);
  const [isReportIssueOpen, setIsReportIssueOpen] = useState(false);

  // State for content sidebar (physical assessment only)
  const [contentSidebarType, setContentSidebarType] = useState<'physical-assessment' | null>(null);

  // State for patient information sidebar
  const [isPatientInfoSidebarOpen, setIsPatientInfoSidebarOpen] = useState(false);

  // State for note (single note per chat, auto-saves)
  const [noteText, setNoteText] = useState('');

  // Auto-save note with debounce
  useEffect(() => {
    if (noteText === '') return; // Don't save empty initial state
    
    const timeoutId = setTimeout(() => {
      // Future: API call to save note
      console.log('Auto-saved note');
    }, 1000); // Save 1 second after user stops typing

    return () => clearTimeout(timeoutId);
  }, [noteText]);

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNoteText(e.target.value);
  };

  // State for voice mode
  const [isVoiceModeActive, setIsVoiceModeActive] = useState(false);

  // State for sidebar visibility
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  // State for chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatId = `chat-${groupId}-${patientId}`; // Mock chat ID

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Memoize grouped case materials to avoid recomputing on every render
  const groupedCaseMaterials = useMemo(() => {
    return caseMaterials.reduce((acc, material) => {
      if (!acc[material.group]) {
        acc[material.group] = [];
      }
      acc[material.group].push(material);
      return acc;
    }, {} as Record<string, typeof caseMaterials>);
  }, [caseMaterials]);

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
   * Handle conclude interaction confirmation
   */
  const handleConcludeInteraction = () => {
    console.log('Concluding interaction...');
    setIsConfirmConcludeOpen(false);
    // Future: Show AI debrief and disable chat input
    // Navigate to debrief page or show debrief dialog
  };

  /**
   * Handle report issue submission
   */
  const handleReportIssue = (issues: string[], details: string) => {
    console.log('Issue reported:', { issues, details, chatId, timestamp: new Date().toISOString() });
    // Future: Send report to backend with chat context
    // API call to save issue report with full chat history
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
    <PageContainer>
      {/* Patient Information Dialog */}
      <PatientInformationDialog
        isOpen={isPatientInfoOpen}
        onClose={() => setIsPatientInfoOpen(false)}
        files={patientFiles}
      />

      {/* Confirm Conclude Dialog */}
      <ConfirmConcludeDialog
        isOpen={isConfirmConcludeOpen}
        onCancel={() => setIsConfirmConcludeOpen(false)}
        onConfirm={handleConcludeInteraction}
      />

      {/* Report Issue Dialog */}
      <ReportIssueDialog
        isOpen={isReportIssueOpen}
        onClose={() => setIsReportIssueOpen(false)}
        onSubmit={handleReportIssue}
      />

      {/* Header */}
      <header className="flex-shrink-0 flex border-b border-border items-center justify-between py-6 px-8" style={{ backgroundColor: UI_COLORS.header.background }}>
        <div className="flex items-center gap-4">
          {/* Sidebar Toggle Button */}
          <button
            onClick={() => setIsSidebarVisible(!isSidebarVisible)}
            className="p-2 rounded-lg transition-colors"
            style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
            aria-label="Toggle sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <UserAvatar
            name={user.name}
            imageUrl={user.avatarUrl}
            size="medium"
          />
          <div className="flex flex-col items-start gap-0.5">
            <h1 className="font-bold tracking-tight leading-tight text-2xl" style={{ color: UI_COLORS.text.heading }}>
              AI Patient
            </h1>
            <button
              onClick={handleBackToPatientDashboard}
              className="font-normal text-sm flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 transition-colors"
              style={{ color: UI_COLORS.text.body }}
              onMouseEnter={(e) => e.currentTarget.style.color = UI_COLORS.text.heading}
              onMouseLeave={(e) => e.currentTarget.style.color = UI_COLORS.text.body}
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
            className="px-6 transition-colors"
            style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
          >
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <aside 
          className="flex flex-col transition-all duration-300 ease-in-out"
          aria-hidden={!isSidebarVisible}
          style={{ 
            backgroundColor: UI_COLORS.background.white, 
            borderRightWidth: isSidebarVisible ? '1px' : '0px', 
            borderRightStyle: 'solid', 
            borderRightColor: UI_COLORS.border.default,
            width: isSidebarVisible ? '16rem' : '0rem',
            minWidth: isSidebarVisible ? '16rem' : '0rem',
            overflowY: isSidebarVisible ? 'auto' : 'hidden',
            overflowX: 'hidden',
            opacity: isSidebarVisible ? 1 : 0,
            pointerEvents: isSidebarVisible ? 'auto' : 'none',
          }}
        >
          {/* Patient Info */}
          <div className="p-6" style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: UI_COLORS.border.default }}>
            <h2 className="font-semibold text-lg mb-1 whitespace-nowrap" style={{ color: UI_COLORS.text.heading }}>{patient.name}</h2>
            <p className="text-sm whitespace-nowrap" style={{ color: UI_COLORS.text.body }}>{patient.gender}, {patient.age} years old</p>
          </div>

          {/* Notes Section */}
          <div className="p-4 flex flex-col flex-shrink-0" style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: UI_COLORS.border.default }}>
            <h3 className="font-semibold text-sm mb-3 whitespace-nowrap" style={{ color: UI_COLORS.text.heading }}>Notes</h3>
            <p className="text-xs mb-2 whitespace-nowrap" style={{ color: UI_COLORS.text.muted }}>This note saves automatically!</p>
            
            {/* Note Textarea - Auto-saves */}
            <textarea
              value={noteText}
              onChange={handleNoteChange}
              placeholder="Type your notes here..."
              className="w-full px-3 py-2 rounded-lg resize-none focus:outline-none focus:ring-2"
              style={{ 
                borderWidth: '1px', 
                borderStyle: 'solid', 
                borderColor: UI_COLORS.border.default,
                outlineColor: UI_COLORS.border.medium,
                height: '300px',
              }}
            />
          </div>

          {/* Sidebar Buttons */}
          <div className="mt-auto flex flex-col gap-3 p-4">
            <Button
              variant="outline"
              className="w-full justify-start transition-colors border-0 whitespace-nowrap"
              style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
              onClick={() => setIsPatientInfoSidebarOpen(true)}
            >
              <User className="w-5 h-5 mr-2" />
              Patient Information
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start transition-colors border-0 whitespace-nowrap"
              style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
              onClick={() => setContentSidebarType('physical-assessment')}
            >
              <Stethoscope className="w-5 h-5 mr-2" />
              Physical Assessment
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-white hover:opacity-90 border-0 whitespace-nowrap"
              style={{ backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[1] }}
              onClick={() => setIsConfirmConcludeOpen(true)}
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Conclude Interaction
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-white hover:opacity-90 border-0 whitespace-nowrap"
              style={{ backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[1] }}
              onClick={() => setIsReportIssueOpen(true)}
            >
              <Flag className="w-5 h-5 mr-2" />
              Report Issue
            </Button>
          </div>
        </aside>

        {/* Patient Information Sidebar - Slides from right of notes sidebar */}
        <aside 
          className="flex flex-col transition-all duration-300 ease-in-out flex-shrink-0"
          aria-hidden={!isPatientInfoSidebarOpen}
          style={{ 
            backgroundColor: UI_COLORS.background.white, 
            borderRightWidth: isPatientInfoSidebarOpen ? '1px' : '0px', 
            borderRightStyle: 'solid', 
            borderRightColor: UI_COLORS.border.default,
            width: isPatientInfoSidebarOpen ? '20rem' : '0rem',
            minWidth: isPatientInfoSidebarOpen ? '20rem' : '0rem',
            overflowY: isPatientInfoSidebarOpen ? 'auto' : 'hidden',
            overflowX: 'hidden',
            opacity: isPatientInfoSidebarOpen ? 1 : 0,
            pointerEvents: isPatientInfoSidebarOpen ? 'auto' : 'none',
          }}
        >
          {/* Header with close button */}
          {isPatientInfoSidebarOpen && (
            <div className="p-4 flex items-center justify-between flex-shrink-0" style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: UI_COLORS.border.default }}>
              <h2 className="font-semibold text-lg whitespace-nowrap" style={{ color: UI_COLORS.text.heading }}>
                Patient Information
              </h2>
              <button
                onClick={() => setIsPatientInfoSidebarOpen(false)}
                className="p-2 rounded-lg transition-colors"
                style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
                aria-label="Close patient information sidebar"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Content Area - Empty for now */}
          <div className="flex-1 overflow-y-auto p-4">
            {isPatientInfoSidebarOpen && (
              <div className="space-y-4">
                <p className="text-sm" style={{ color: UI_COLORS.text.body }}>
                  Patient information content will be displayed here.
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* Chat Area */}
        <div 
          className="flex-1 flex flex-col transition-all duration-300 ease-in-out"
          style={{
            marginRight: contentSidebarType ? '24rem' : '0rem',
          }}
        >
          {/* Voice Mode Overlay */}
          {isVoiceModeActive && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center" style={{ backgroundColor: UI_COLORS.background.white }}>
              {/* Patient Avatar */}
              <div className="mb-8">
                <UserAvatar
                  name={patient.name}
                  imageUrl={patient.imageUrl}
                  size="xlarge"
                />
              </div>

              {/* Voice Mode Active Text */}
              <h2 className="text-2xl font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>
                Voice Mode Active
              </h2>
              <p className="text-base mb-12" style={{ color: UI_COLORS.text.body }}>
                Speak naturally to interact with the AI patient.
              </p>

              {/* Voice Visualization Bars */}
              <div className="flex items-center gap-1 mb-16">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 rounded-full animate-pulse"
                    style={{
                      backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[1],
                      height: `${20 + Math.random() * 40}px`,
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                ))}
              </div>

              {/* Control Buttons */}
              <div className="flex gap-4">
                {/* Close Voice Mode Button */}
                <button
                  onClick={() => setIsVoiceModeActive(false)}
                  className="w-16 h-16 rounded-full flex items-center justify-center transition-colors shadow-lg"
                  style={{ backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[1] }}
                  aria-label="Close voice mode"
                >
                  <X className="w-6 h-6 text-white" />
                </button>

                {/* Open Notes Button */}
                <button
                  onClick={() => {
                    // Scroll to notes section in sidebar or just close voice mode
                    setIsVoiceModeActive(false);
                  }}
                  className="w-16 h-16 rounded-full flex items-center justify-center transition-colors shadow-lg"
                  style={{
                    backgroundColor: UI_COLORS.button.primary,
                  }}
                  aria-label="Close voice mode and view notes"
                >
                  <Menu className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>
          )}

          {/* Chat Messages Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full" style={{ color: UI_COLORS.text.light }}>
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
                          : UI_COLORS.background.hoverLight,
                        color: message.student_sent ? UI_COLORS.button.text : UI_COLORS.text.heading,
                      }}
                    >
                      <p className="text-sm leading-relaxed">{message.message_content}</p>
                      <p
                        className="text-xs mt-1"
                        style={{
                          color: message.student_sent ? UI_COLORS.button.text : UI_COLORS.text.muted,
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
          <div className="p-6" style={{ borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: UI_COLORS.border.default }}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsVoiceModeActive(true)}
                className="p-3 rounded-full transition-colors"
                style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
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
                  className="w-full px-4 py-3 pr-12 rounded-lg focus:outline-none focus:ring-2"
                  style={{ 
                    borderWidth: '1px', 
                    borderStyle: 'solid', 
                    borderColor: UI_COLORS.border.default,
                    outlineColor: UI_COLORS.border.medium
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
                  onMouseEnter={(e) => !inputMessage.trim() ? null : e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
                  aria-label="Send message"
                  disabled={!inputMessage.trim()}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content Sidebar (Case Materials or Physical Assessment) - Slides from right edge */}
        <aside 
          className="flex flex-col transition-all duration-300 ease-in-out absolute top-0 bottom-0 right-0 z-30 overflow-y-auto"
          aria-hidden={!contentSidebarType}
          style={{ 
            backgroundColor: UI_COLORS.background.white, 
            borderLeftWidth: '1px', 
            borderLeftStyle: 'solid', 
            borderLeftColor: UI_COLORS.border.default,
            width: '24rem',
            transform: contentSidebarType ? 'translateX(0)' : 'translateX(100%)',
            boxShadow: contentSidebarType ? '-4px 0 6px rgba(0, 0, 0, 0.1)' : 'none',
          }}
        >
          {/* Header with close button */}
          {contentSidebarType && (
            <div className="p-4 flex items-center justify-between" style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: UI_COLORS.border.default }}>
              <h2 className="font-semibold text-lg whitespace-nowrap" style={{ color: UI_COLORS.text.heading }}>
                Physical Assessment
              </h2>
              <button
                onClick={() => setContentSidebarType(null)}
                className="p-2 rounded-lg transition-colors"
                style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
                aria-label="Close content sidebar"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4">
            {contentSidebarType === 'physical-assessment' && (
              <div className="space-y-6">
                {/* Group materials by their 'group' property */}
                {Object.entries(groupedCaseMaterials).map(([groupName, materials]) => (
                  <div key={groupName}>
                    {/* Group Header */}
                    <h3 className="font-semibold text-base mb-3 pb-2" style={{ color: UI_COLORS.text.heading, borderBottomWidth: '2px', borderBottomStyle: 'solid', borderBottomColor: UI_COLORS.border.default }}>
                      {groupName}
                    </h3>
                    
                    {/* Materials in this group */}
                    <div className="space-y-3">
                      {materials.map((material) => (
                        <div
                          key={material.id}
                          className="p-4 rounded-lg"
                          style={{ backgroundColor: UI_COLORS.background.hoverLight }}
                        >
                          <div className="flex items-start gap-3">
                            <FileText className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: UI_COLORS.text.muted }} />
                            <div className="flex-1">
                              <h4 className="font-semibold text-sm mb-1" style={{ color: UI_COLORS.text.heading }}>
                                {material.title}
                              </h4>
                              <p className="text-xs" style={{ color: UI_COLORS.text.body }}>
                                {material.description}
                              </p>
                              <p className="text-xs mt-1" style={{ color: UI_COLORS.text.muted }}>
                                Type: {material.type}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}

export default StudentChatPage;
