import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import UserAvatar from '@/components/UserAvatar';
import { mockDataService } from '@/services/studentService';
import { ArrowLeft, FileText, User, Stethoscope, Flag, Eye, Menu, ChevronRight } from 'lucide-react';
import { SIMULATION_GROUP_COLOR_PALETTE, UI_COLORS } from '@/lib/colors';
import { useState, useRef, useEffect, useMemo } from 'react';
import PatientInformationDialog from '@/components/PatientInformationDialog';
import ReportIssueDialog from '@/components/ReportIssueDialog';
import AIDebriefDialog from '@/components/AIDebriefDialog';

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
 * ChatHistoryPage Component
 * 
 * Read-only view of completed chat history with AI patient.
 * Displays full conversation history without ability to send new messages.
 */
function ChatHistoryPage() {
  const navigate = useNavigate();
  const { groupId, patientId, chatId } = useParams();
  
  // Load user data from mock data service
  const user = mockDataService.getCurrentUser();
  
  // Mock patient data
  const patient = {
    id: patientId,
    name: 'Pamela',
    age: 56,
    gender: 'Female',
    imageUrl: undefined as string | undefined,
  };

  // State for dialogs
  const [isPatientInfoOpen, setIsPatientInfoOpen] = useState(false);
  const [isReportIssueOpen, setIsReportIssueOpen] = useState(false);
  const [isAIDebriefOpen, setIsAIDebriefOpen] = useState(false);

  // State for content sidebar (physical assessment only)
  const [contentSidebarType, setContentSidebarType] = useState<'physical-assessment' | null>(null);

  // State for sidebar visibility
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  // Mock saved note - will be fetched from database (read-only in history view)
  const savedNote = 'Patient reports chest pain with pressure-like sensation. Need to check ECG results and vital signs. Considering cardiac workup.';

  // State for chat - Mock data, will be replaced with database fetch
  const [messages ] = useState<Message[]>([
    {
      message_id: 'msg-1',
      chat_id: chatId || '',
      student_sent: true,
      message_content: 'Hello, I\'m here to help you today. Can you tell me what brings you in?',
      time_sent: '2026-02-18T10:00:00Z',
    },
    {
      message_id: 'msg-2',
      chat_id: chatId || '',
      student_sent: false,
      message_content: 'I\'ve been having chest pain for the past few hours.',
      time_sent: '2026-02-18T10:00:30Z',
    },
    {
      message_id: 'msg-3',
      chat_id: chatId || '',
      student_sent: true,
      message_content: 'I understand. Can you describe the pain? Is it sharp, dull, or pressure-like?',
      time_sent: '2026-02-18T10:01:00Z',
    },
    {
      message_id: 'msg-4',
      chat_id: chatId || '',
      student_sent: false,
      message_content: 'It feels like pressure, like my chest is being constricted.',
      time_sent: '2026-02-18T10:01:45Z',
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on mount
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Mock case materials data
  const caseMaterials = [
    {
      id: '1',
      title: 'Initial Triage Vital Signs',
      description: 'Recorded upon arrival to clinic.',
      type: 'image' as const,
      group: 'Vital Signs',
    },
    {
      id: '2',
      title: '12-Lead Electrocardiogram (ECG)',
      description: 'Standard 12-lead ECG performed during assessment to evaluate cardiac rhythm and possible ischemic changes.',
      type: 'image' as const,
      group: 'Diagnostic Tests',
    },
    {
      id: '3',
      title: 'Lung Auscultation Recording',
      description: 'Audio recording of lung sounds to evaluate respiratory status.',
      type: 'video' as const,
      group: 'Physical Examination',
    },
  ];

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

  // Mock patient information files
  const patientFiles = [
    {
      id: '1',
      filename: 'Patient_Information_Upload_Pamela.pdf',
      description: 'No description available',
    },
  ];

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
   * Handle view AI debrief
   */
  const handleViewAIDebrief = () => {
    setIsAIDebriefOpen(true);
  };

  /**
   * Handle report issue submission
   */
  const handleReportIssue = (issues: string[], details: string) => {
    console.log('Issue reported:', { issues, details, chatId, timestamp: new Date().toISOString() });
  };

  /**
   * Format timestamp for display
   */
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: UI_COLORS.background.white }}>
      {/* Patient Information Dialog */}
      <PatientInformationDialog
        isOpen={isPatientInfoOpen}
        onClose={() => setIsPatientInfoOpen(false)}
        files={patientFiles}
      />

      {/* Report Issue Dialog */}
      <ReportIssueDialog
        isOpen={isReportIssueOpen}
        onClose={() => setIsReportIssueOpen(false)}
        onSubmit={handleReportIssue}
      />

      {/* AI Debrief Dialog */}
      <AIDebriefDialog
        isOpen={isAIDebriefOpen}
        onClose={() => setIsAIDebriefOpen(false)}
      />

      {/* Header */}
      <header className="flex border-b border-border items-center justify-between py-6 px-8" style={{ backgroundColor: UI_COLORS.header.background }}>
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
              Chat History
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
        {/* Left Sidebar */}
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
            overflow: 'hidden',
            opacity: isSidebarVisible ? 1 : 0,
            pointerEvents: isSidebarVisible ? 'auto' : 'none',
          }}
        >
          {/* Patient Info */}
          <div className="p-6" style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: UI_COLORS.border.default }}>
            <h2 className="font-semibold text-lg mb-1 whitespace-nowrap" style={{ color: UI_COLORS.text.heading }}>{patient.name}</h2>
            <p className="text-sm whitespace-nowrap" style={{ color: UI_COLORS.text.body }}>{patient.gender}, {patient.age} years old</p>
          </div>

          {/* Notes Section - Read Only */}
          <div className="p-4 flex flex-col flex-shrink-0" style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: UI_COLORS.border.default }}>
            <h3 className="font-semibold text-sm mb-3 whitespace-nowrap" style={{ color: UI_COLORS.text.heading }}>Notes</h3>
            
            {/* Saved Note - Read Only */}
            {savedNote ? (
              <div
                className="w-full px-3 py-2 rounded-lg"
                style={{ 
                  borderWidth: '1px', 
                  borderStyle: 'solid', 
                  borderColor: UI_COLORS.border.default,
                  backgroundColor: UI_COLORS.background.hoverLight,
                  height: '300px',
                  overflowY: 'auto',
                }}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: UI_COLORS.text.body }}>
                  {savedNote}
                </p>
              </div>
            ) : (
              <p className="text-xs" style={{ color: UI_COLORS.text.muted }}>No notes saved for this chat.</p>
            )}
          </div>

          {/* Sidebar Buttons */}
          <div className="mt-auto flex flex-col gap-3 p-4">
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
              className="w-full justify-start transition-colors border-0 whitespace-nowrap"
              style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
              onClick={() => setIsPatientInfoOpen(true)}
            >
              <User className="w-5 h-5 mr-2" />
              Patient Information
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-white hover:opacity-90 border-0 whitespace-nowrap"
              style={{ backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[2] }}
              onClick={handleViewAIDebrief}
            >
              <Eye className="w-5 h-5 mr-2" />
              View AI Debrief
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

        {/* Chat Area - Read Only */}
        <div 
          className="flex-1 flex flex-col transition-all duration-300 ease-in-out"
          style={{
            marginRight: contentSidebarType ? '24rem' : '0rem',
          }}
        >
          {/* Chat Messages Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full" style={{ color: UI_COLORS.text.light }}>
                <p>No messages in this chat history.</p>
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
        </div>

        {/* Content Sidebar (Physical Assessment) - Slides from right edge */}
        <aside 
          className="flex flex-col transition-all duration-300 ease-in-out absolute top-0 bottom-0 right-0 z-30"
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
    </div>
  );
}

export default ChatHistoryPage;
