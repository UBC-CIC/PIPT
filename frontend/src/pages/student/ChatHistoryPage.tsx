import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import PageContainer from '@/components/PageContainer';
import UserAvatar from '@/components/UserAvatar';
import { mockDataService, type StudentChatMessage as Message } from '@/services/studentService';
import { ArrowLeft, FileText, User, Stethoscope, Flag, Eye, Menu, ChevronRight, ChevronLeft } from 'lucide-react';
import { SIMULATION_GROUP_COLOR_PALETTE, UI_COLORS } from '@/lib/colors';
import { useState, useRef, useEffect, useMemo } from 'react';
import PatientInformationDialog from '@/components/PatientInformationDialog';
import ReportIssueDialog from '@/components/ReportIssueDialog';
import AIDebriefDialog from '@/components/AIDebriefDialog';
import { useAuth } from '@/App';

/**
 * ChatHistoryPage Component
 * 
 * Read-only view of completed chat history with AI patient.
 * Displays full conversation history without ability to send new messages.
 */
function ChatHistoryPage() {
  const navigate = useNavigate();
  const { groupId, patientId, chatId } = useParams();
  
  // Load user data from auth context
  const { user: authUser } = useAuth();
  const user = { name: authUser?.email || 'Student', avatarUrl: undefined };
  
  // Load patient data from mock data service
  const patient = mockDataService.getPatientDetail(patientId);

  // State for dialogs
  const [isPatientInfoOpen, setIsPatientInfoOpen] = useState(false);
  const [isReportIssueOpen, setIsReportIssueOpen] = useState(false);
  const [isAIDebriefOpen, setIsAIDebriefOpen] = useState(false);

  // State for content sidebar (physical assessment only)
  const [contentSidebarType, setContentSidebarType] = useState<'physical-assessment' | null>(null);

  // State for patient information sidebar
  const [isPatientInfoSidebarOpen, setIsPatientInfoSidebarOpen] = useState(false);

  // State for sidebar visibility
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  // Load saved note from mock data service (read-only in history view)
  const savedNote = mockDataService.getSavedNote();

  // Load chat messages from mock data service
  const [messages ] = useState<Message[]>(() => mockDataService.getChatHistoryMessages(chatId || ''));

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on mount
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load case materials from mock data service
  const caseMaterials = mockDataService.getCaseMaterials();

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

  // Load patient files from mock data service
  const patientFiles = mockDataService.getPatientFiles();

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
    <PageContainer>
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

          {/* Content Area - Uploaded documents grouped by category */}
          <div className="flex-1 overflow-y-auto p-4">
            {isPatientInfoSidebarOpen && (
              <div className="space-y-6">
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
                    className={`flex gap-3 ${message.sender_type === 'student' ? 'justify-end' : 'justify-start'}`}
                  >
                    {/* Avatar for AI patient (left side) */}
                    {message.sender_type !== 'student' && (
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
                        message.sender_type === 'student' ? 'rounded-br-none' : 'rounded-bl-none'
                      }`}
                      style={{
                        backgroundColor: message.sender_type === 'student'
                          ? SIMULATION_GROUP_COLOR_PALETTE[2]
                          : UI_COLORS.background.hoverLight,
                        color: message.sender_type === 'student' ? UI_COLORS.button.text : UI_COLORS.text.heading,
                      }}
                    >
                      <p className="text-sm leading-relaxed">{message.message_content}</p>
                      <p
                        className="text-xs mt-1"
                        style={{
                          color: message.sender_type === 'student' ? UI_COLORS.button.text : UI_COLORS.text.muted,
                          opacity: message.sender_type === 'student' ? 0.8 : 1,
                        }}
                      >
                        {formatTime(message.sent_at)}
                      </p>
                    </div>

                    {/* Avatar for student (right side) */}
                    {message.sender_type === 'student' && (
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
                <p className="text-sm" style={{ color: UI_COLORS.text.body }}>
                  Physical assessment content will be displayed here.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}

export default ChatHistoryPage;
