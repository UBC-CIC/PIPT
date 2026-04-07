import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import PageContainer from '@/components/PageContainer';
import UserAvatar from '@/components/UserAvatar';
import { studentService, type StudentChatMessage as Message, type PatientDetail, type StudentCaseMaterial, type PatientFile, type AIDebriefData, type PersonaMedia } from '@/services/studentService';
import { ArrowLeft, Mic, Send, FileText, User, CheckCircle, X, Menu, Stethoscope, Flag, ChevronRight, ChevronLeft, Eye, Loader2, ArrowLeftIcon } from 'lucide-react';
import { SIMULATION_GROUP_COLOR_PALETTE, UI_COLORS } from '@/lib/colors';
import { useState, useRef, useEffect } from 'react';
// CaseMaterialsDialog and PhysicalAssessmentDialog are rendered inline in the sidebar
import ConfirmConcludeDialog from '@/components/ConfirmConcludeDialog';
import PhysicalAssessmentContent from '@/components/PhysicalAssessmentContent';
import ReportIssueDialog from '@/components/ReportIssueDialog';
import AIDebriefDialog from '@/components/AIDebriefDialog';
import { useAuth } from '@/App';
import { useResizablePanel } from '@/hooks/useResizablePanel';

/**
 * Attempts to extract structured debrief data from a raw JSON string.
 * Handles both complete and truncated JSON from the LLM.
 * Tries direct parse first, then progressively repairs truncated JSON
 * by closing open brackets/braces.
 */
function extractDebriefFromRawJson(raw: string): Record<string, unknown> | null {
  // 1. Try direct parse
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object' && obj.summary) return obj;
  } catch { /* continue to repair attempts */ }

  // 2. Find the JSON object boundaries and try to repair truncated JSON
  const firstBrace = raw.indexOf('{');
  if (firstBrace === -1) return null;

  let jsonStr = raw.slice(firstBrace);

  // Try progressively closing the JSON to make it parseable
  // The LLM may have been cut off mid-output
  const closers = ['"}', '"]', '}]', '}}', '}'];
  for (let attempt = 0; attempt < 8; attempt++) {
    for (const closer of closers) {
      try {
        const repaired = jsonStr + closer.repeat(attempt + 1);
        const obj = JSON.parse(repaired);
        if (obj && typeof obj === 'object' && obj.summary) return obj;
      } catch { /* try next */ }
    }
    // Also try adding specific common truncation repairs
    try {
      const obj = JSON.parse(jsonStr + ']}]}');
      if (obj && typeof obj === 'object' && obj.summary) return obj;
    } catch { /* try next */ }
    try {
      const obj = JSON.parse(jsonStr + '"}]}');
      if (obj && typeof obj === 'object' && obj.summary) return obj;
    } catch { /* try next */ }
  }

  // 3. Last resort: truncate to the last complete key-value and close
  const lastCompleteComma = jsonStr.lastIndexOf('",');
  const lastCompleteBracket = jsonStr.lastIndexOf('],');
  const lastCompleteBrace = jsonStr.lastIndexOf('},');
  const cutPoint = Math.max(lastCompleteComma, lastCompleteBracket, lastCompleteBrace);
  
  if (cutPoint > 0) {
    const truncated = jsonStr.slice(0, cutPoint + 1);
    // Count open braces/brackets and close them
    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    let escaped = false;
    for (const ch of truncated) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') openBraces++;
      if (ch === '}') openBraces--;
      if (ch === '[') openBrackets++;
      if (ch === ']') openBrackets--;
    }
    const suffix = ']'.repeat(Math.max(0, openBrackets)) + '}'.repeat(Math.max(0, openBraces));
    try {
      const obj = JSON.parse(truncated + suffix);
      if (obj && typeof obj === 'object' && obj.summary) return obj;
    } catch { /* give up */ }
  }

  return null;
}

/**
 * StudentChatPage Component
 * 
 * Interactive chat interface for medical simulation with AI patient.
 */
function StudentChatPage() {
  const navigate = useNavigate();
  const { groupId, patientId, chatId: routeChatId } = useParams();
  
  // Load user data from auth context
  const { user: authUser } = useAuth();
  const user = { name: authUser?.email || 'Student', avatarUrl: undefined };
  
  // Patient data, case materials, and patient files loaded from API
  const [patient, setPatient] = useState<PatientDetail>({ id: patientId, name: 'Loading...', age: 0, gender: '' });
  const [, setCaseMaterials] = useState<StudentCaseMaterial[]>([]);
  const [patientFiles, setPatientFiles] = useState<PatientFile[]>([]);

  // Fetch patient detail, case materials, and patient files from real API
  useEffect(() => {
    if (!groupId || !patientId) return;
    let cancelled = false;

    studentService.fetchPatientDetail(groupId, patientId).then((data) => {
      if (!cancelled) setPatient(data);
    });
    studentService.fetchCaseMaterials(groupId, patientId).then((data) => {
      if (!cancelled) setCaseMaterials(data);
    });
    studentService.fetchPatientFiles(groupId, patientId).then((data) => {
      if (!cancelled) setPatientFiles(data);
    });

    return () => { cancelled = true; };
  }, [groupId, patientId]);

  // State for dialogs
  const [isConfirmConcludeOpen, setIsConfirmConcludeOpen] = useState(false);
  const [isReportIssueOpen, setIsReportIssueOpen] = useState(false);
  const [isAIDebriefOpen, setIsAIDebriefOpen] = useState(false);

  // Session lifecycle status
  const [sessionStatus, setSessionStatus] = useState<'active' | 'generating_debrief' | 'concluded'>('active');
  const [debriefData, setDebriefData] = useState<AIDebriefData | null>(null);

  // State for content sidebar (physical assessment only)
  const [contentSidebarType, setContentSidebarType] = useState<'physical-assessment' | null>(null);
  const [personaMedia, setPersonaMedia] = useState<PersonaMedia[]>([]);
  const [personaMediaLoading, setPersonaMediaLoading] = useState(false);

  // Fetch persona media when physical assessment sidebar opens
  useEffect(() => {
    if (contentSidebarType !== 'physical-assessment' || !patientId) return;
    let cancelled = false;
    setPersonaMediaLoading(true);
    studentService.fetchPersonaMedia(patientId).then((data) => {
      if (!cancelled) {
        setPersonaMedia(data);
        setPersonaMediaLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [contentSidebarType, patientId]);

  // State for patient information sidebar
  const [isPatientInfoSidebarOpen, setIsPatientInfoSidebarOpen] = useState(false);
  const [selectedPatientFile, setSelectedPatientFile] = useState<PatientFile | null>(null);

  // State for note (single note per chat, auto-saves)
  const [noteText, setNoteText] = useState('');
  const noteLoadedRef = useRef(false);

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNoteText(e.target.value);
  };

  // State for voice mode
  const [isVoiceModeActive, setIsVoiceModeActive] = useState(false);

  // State for sidebar visibility
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  // Resizable sidebars
  const {
    width: patientInfoWidth,
    sidebarRef: patientInfoRef,
    handleMouseDown: onPatientInfoDrag,
  } = useResizablePanel({ defaultWidth: 320, minWidth: 250, maxWidth: 700, direction: 'left' });
  const {
    width: physicalAssessmentWidth,
    sidebarRef: physicalAssessmentRef,
    handleMouseDown: onPhysicalAssessmentDrag,
  } = useResizablePanel({ defaultWidth: 384, minWidth: 250, maxWidth: 700, direction: 'right' });

  // State for chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatId = `chat-${groupId}-${patientId}`; // Mock chat ID

  // Guard to prevent duplicate session creation (React StrictMode double-mount)
  const sessionCreationRef = useRef(false);
  // Ref to track if AI greeting has been triggered
  const greetingTriggeredRef = useRef(false);

  // Create a session on mount (new chat) or use existing session ID from route
  useEffect(() => {
    if (!groupId || !patientId) return;
    let cancelled = false;

    if (routeChatId) {
      // Resuming an existing session — set the ID and load messages + debrief
      setSessionId(routeChatId);
      studentService.fetchMessages(routeChatId).then((msgs) => {
        if (!cancelled && msgs.length > 0) {
          setMessages(msgs);
        }
      });
      studentService.fetchDebrief(routeChatId).then((data) => {
        if (!cancelled && data) {
          setDebriefData(data);
          setSessionStatus('concluded');
        }
      });
    } else if (!sessionCreationRef.current) {
      // New chat — create a fresh session (guarded against StrictMode double-mount)
      sessionCreationRef.current = true;
      studentService.createSession(groupId, patientId, `Session ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`).then((session) => {
        if (session) {
          setSessionId(session.chat_id);
        }
      });
    }

    return () => { cancelled = true; };
  }, [groupId, patientId, routeChatId]);

  // Load notes from API when session is available
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    noteLoadedRef.current = false;

    studentService.fetchNotes(sessionId).then((notes) => {
      if (!cancelled) {
        setNoteText(notes);
        noteLoadedRef.current = true;
      }
    });

    return () => { cancelled = true; };
  }, [sessionId]);

  // Auto-save note with debounce
  useEffect(() => {
    if (!noteLoadedRef.current || !sessionId) return;
    
    const timeoutId = setTimeout(() => {
      studentService.updateNotes(sessionId, noteText);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [noteText, sessionId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Trigger AI greeting when a new session is created (not a resumed chat)
  useEffect(() => {
    if (!sessionId || !groupId || !patientId || routeChatId || greetingTriggeredRef.current) return;
    greetingTriggeredRef.current = true;

    setIsAiResponding(true);
    const aiGreetingId = `msg-greeting-${Date.now()}`;
    let greetingAdded = false;

    studentService.sendMessageStreaming(
      groupId, patientId, sessionId, '',
      {
        onChunk: (text) => {
          if (!greetingAdded) {
            greetingAdded = true;
            setMessages([{
              message_id: aiGreetingId,
              chat_id: chatId,
              sender_type: 'ai',
              message_content: text,
              sent_at: new Date().toISOString(),
            }]);
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.message_id === aiGreetingId
                  ? { ...m, message_content: m.message_content + text }
                  : m
              )
            );
          }
        },
        onDone: (fullText) => {
          if (!greetingAdded) {
            setMessages([{
              message_id: aiGreetingId,
              chat_id: chatId,
              sender_type: 'ai',
              message_content: fullText || 'Hello! How can I help you today?',
              sent_at: new Date().toISOString(),
            }]);
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.message_id === aiGreetingId
                  ? { ...m, message_content: fullText || m.message_content }
                  : m
              )
            );
          }
          setIsAiResponding(false);
        },
        onError: (error) => {
          console.error('AI greeting error:', error);
          setMessages([{
            message_id: aiGreetingId,
            chat_id: chatId,
            sender_type: 'ai',
            message_content: 'Hello! How can I help you today?',
            sent_at: new Date().toISOString(),
          }]);
          setIsAiResponding(false);
        },
      },
    ).catch((err) => {
      console.error('AI greeting streaming failed:', err);
      setMessages([{
        message_id: aiGreetingId,
        chat_id: chatId,
        sender_type: 'ai',
        message_content: 'Hello! How can I help you today?',
        sent_at: new Date().toISOString(),
      }]);
      setIsAiResponding(false);
    });
  }, [sessionId]);

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
  const handleConcludeInteraction = async (recommendations: string) => {
    if (!groupId || !patientId || !sessionId) return;

    setIsConfirmConcludeOpen(false);
    setSessionStatus('generating_debrief');

    // Call the conclude API
    const result = await studentService.concludeInteraction(groupId, patientId, sessionId, recommendations);

    if (!result.success) {
      console.error('Failed to conclude interaction');
      setSessionStatus('active');
      return;
    }

    // Listen for the debrief result via AppSync subscription
    // The backend publishes a "debrief" event when generation is complete
    try {
      const { subscribeToTextStream } = await import('@/lib/appsync-client');
      const unsubscribe = await subscribeToTextStream(sessionId, (event) => {
        if (event.type === 'debrief') {
          try {
            let parsed = JSON.parse(event.content);
            
            // Safety net: if the backend JSON parse failed, the entire LLM output
            // ends up in the "summary" field as a raw JSON string. Detect this and
            // extract the structured data from it.
            if (
              parsed.summary &&
              typeof parsed.summary === 'string' &&
              parsed.summary.trimStart().startsWith('{') &&
              (!parsed.questions_addressed || parsed.questions_addressed.length === 0)
            ) {
              const extracted = extractDebriefFromRawJson(parsed.summary);
              if (extracted) {
                parsed = extracted;
              }
            }

            // questions_addressed may be strings (legacy) or objects with question_text (enhanced)
            const addressedQuestions = (parsed.questions_addressed || []).map(
              (q: string | { question_text?: string; quality_assessment?: string }) =>
                typeof q === 'string' ? q : (q.question_text || 'Unknown question')
            );
            const missedQuestions = (parsed.questions_missed || []).map(
              (q: string | { question_text?: string }) =>
                typeof q === 'string' ? q : (q.question_text || 'Unknown question')
            );
            setDebriefData({
              summary: parsed.summary || '',
              questionsAddressed: addressedQuestions,
              missedKeyQuestionsCount: missedQuestions.length,
              missedQuestions: missedQuestions,
              missedQuestionsGuidance: parsed.reasoning_gaps || '',
              overallScore: typeof parsed.overall_score === 'number' ? parsed.overall_score : undefined,
              recommendationFeedback: {
                strengths: parsed.recommendation_feedback?.strengths || [],
                areasForImprovement: parsed.recommendation_feedback?.areas_for_improvement || [],
              },
              suggestedRewrites: (parsed.suggested_rewrites || []).map(
                (r: { original_message?: string; suggested_rewrite?: string }) => ({
                  original: r.original_message || '',
                  suggested: r.suggested_rewrite || '',
                })
              ),
              rubricDescription: 'Compare your recommendations with the answer key provided by your instructor.',
              answerKeyComparison: parsed.answer_key_comparison ? {
                answerKeyAvailable: parsed.answer_key_comparison.answer_key_available ?? false,
                correctElements: parsed.answer_key_comparison.correct_elements,
                missingElements: parsed.answer_key_comparison.missing_elements,
                incorrectElements: parsed.answer_key_comparison.incorrect_elements,
                overallAlignment: parsed.answer_key_comparison.overall_alignment,
              } : undefined,
            });
            setSessionStatus('concluded');
            setIsAIDebriefOpen(true);
          } catch (e) {
            console.error('Failed to parse debrief data:', e);
            setSessionStatus('concluded');
          }
          unsubscribe();
        }
      });
    } catch (err) {
      console.error('Failed to subscribe for debrief:', err);
      // Even if subscription fails, the session is concluded — debrief can be fetched later
      setSessionStatus('concluded');
    }
  };

  /**
   * Handle report issue submission
   */
  const handleReportIssue = (issues: string[], details: string) => {
    console.log('Issue reported:', { issues, details, chatId, timestamp: new Date().toISOString() });
    // Future: Send report to backend with chat context
    // API call to save issue report with full chat history
  };

  // Ref to hold the cancel function for an in-flight streaming request
  const cancelStreamRef = useRef<(() => void) | null>(null);

  // Clean up any in-flight stream on unmount
  useEffect(() => {
    return () => { cancelStreamRef.current?.(); };
  }, []);

  /**
   * Handle sending a message — uses AppSync streaming for real-time chunks
   */
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !groupId || !patientId || !sessionId || isAiResponding) return;

    // Create student message
    const studentMessage: Message = {
      message_id: `msg-${Date.now()}`,
      chat_id: chatId,
      sender_type: 'student',
      message_content: inputMessage,
      sent_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, studentMessage]);
    const messageText = inputMessage;
    setInputMessage('');
    setIsAiResponding(true);

    // Create a placeholder AI message that will be progressively filled
    const aiMessageId = `msg-${Date.now() + 1}`;
    const aiMessage: Message = {
      message_id: aiMessageId,
      chat_id: chatId,
      sender_type: 'ai',
      message_content: '',
      sent_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, aiMessage]);

    try {
      const cancel = await studentService.sendMessageStreaming(
        groupId, patientId, sessionId, messageText,
        {
          onChunk: (text) => {
            // Append chunk to the AI message in-place
            setMessages((prev) =>
              prev.map((m) =>
                m.message_id === aiMessageId
                  ? { ...m, message_content: m.message_content + text }
                  : m
              )
            );
          },
          onDone: (fullText) => {
            // Finalize with the complete text (in case chunks were missed)
            setMessages((prev) =>
              prev.map((m) =>
                m.message_id === aiMessageId
                  ? { ...m, message_content: fullText || m.message_content }
                  : m
              )
            );
            setIsAiResponding(false);
            cancelStreamRef.current = null;
          },
          onError: (error) => {
            console.error('Streaming error:', error);
            setMessages((prev) =>
              prev.map((m) =>
                m.message_id === aiMessageId
                  ? { ...m, message_content: m.message_content || 'Sorry, something went wrong. Please try again.' }
                  : m
              )
            );
            setIsAiResponding(false);
            cancelStreamRef.current = null;
          },
        },
      );
      cancelStreamRef.current = cancel;
    } catch (error) {
      console.error('Failed to start streaming:', error);
      setMessages((prev) =>
        prev.map((m) =>
          m.message_id === aiMessageId
            ? { ...m, message_content: 'Sorry, something went wrong. Please try again.' }
            : m
        )
      );
      setIsAiResponding(false);
    }
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

      {/* AI Debrief Dialog */}
      <AIDebriefDialog
        isOpen={isAIDebriefOpen}
        onClose={() => setIsAIDebriefOpen(false)}
        data={debriefData}
        simulationGroupId={groupId}
        patientId={patientId}
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
            {sessionStatus === 'active' && (
              <Button
                variant="outline"
                className="w-full justify-start text-white hover:opacity-90 border-0 whitespace-nowrap"
                style={{ backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[1] }}
                onClick={() => setIsConfirmConcludeOpen(true)}
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Conclude Interaction
              </Button>
            )}
            {(sessionStatus === 'generating_debrief' || sessionStatus === 'concluded') && (
              <Button
                variant="outline"
                className="w-full justify-start text-white hover:opacity-90 border-0 whitespace-nowrap"
                style={{ backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[2], opacity: sessionStatus === 'generating_debrief' ? 0.6 : 1 }}
                onClick={() => sessionStatus === 'concluded' && setIsAIDebriefOpen(true)}
                disabled={sessionStatus === 'generating_debrief'}
              >
                <Eye className="w-5 h-5 mr-2" />
                {sessionStatus === 'generating_debrief' ? 'Generating Debrief...' : 'View AI Debrief'}
              </Button>
            )}
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
          ref={patientInfoRef as React.RefObject<HTMLElement>}
          className="flex flex-col flex-shrink-0 relative"
          aria-hidden={!isPatientInfoSidebarOpen}
          style={{ 
            backgroundColor: UI_COLORS.background.white, 
            borderRightWidth: isPatientInfoSidebarOpen ? '1px' : '0px', 
            borderRightStyle: 'solid', 
            borderRightColor: UI_COLORS.border.default,
            width: isPatientInfoSidebarOpen ? `${patientInfoWidth}px` : '0px',
            minWidth: isPatientInfoSidebarOpen ? `${patientInfoWidth}px` : '0px',
            overflowY: isPatientInfoSidebarOpen ? 'auto' : 'hidden',
            overflowX: 'hidden',
            opacity: isPatientInfoSidebarOpen ? 1 : 0,
            pointerEvents: isPatientInfoSidebarOpen ? 'auto' : 'none',
            transition: 'opacity 0.3s ease-in-out',
          }}
        >
          {/* Drag handle for resizing */}
          {isPatientInfoSidebarOpen && (
            <div
              onMouseDown={onPatientInfoDrag}
              style={{
                position: 'absolute',
                top: 0,
                right: -3,
                bottom: 0,
                width: 6,
                cursor: 'col-resize',
                zIndex: 10,
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            />
          )}
          {/* Header with close button */}
          {isPatientInfoSidebarOpen && (
            <div className="p-4 flex items-center justify-between flex-shrink-0" style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: UI_COLORS.border.default }}>
              <h2 className="font-semibold text-lg whitespace-nowrap" style={{ color: UI_COLORS.text.heading }}>
                Patient Information
              </h2>
              <button
                onClick={() => { setIsPatientInfoSidebarOpen(false); setSelectedPatientFile(null); }}
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

          {/* Content Area - Patient info files with inline PDF viewer */}
          <div className="flex-1 overflow-y-auto p-4">
            {isPatientInfoSidebarOpen && (
              selectedPatientFile ? (
                <div className="flex flex-col h-full">
                  <button
                    onClick={() => setSelectedPatientFile(null)}
                    className="flex items-center gap-1 text-sm mb-3 bg-transparent border-0 cursor-pointer p-0 transition-colors"
                    style={{ color: UI_COLORS.text.body }}
                    onMouseEnter={(e) => e.currentTarget.style.color = UI_COLORS.text.heading}
                    onMouseLeave={(e) => e.currentTarget.style.color = UI_COLORS.text.body}
                  >
                    <ArrowLeftIcon className="w-4 h-4" />
                    Back to files
                  </button>
                  <h4 className="font-semibold text-sm mb-2" style={{ color: UI_COLORS.text.heading }}>
                    {selectedPatientFile.filename}
                  </h4>
                  {selectedPatientFile.url ? (
                    <iframe
                      src={selectedPatientFile.url}
                      title={selectedPatientFile.filename}
                      className="w-full flex-1 rounded border"
                      style={{ borderColor: UI_COLORS.border.default, minHeight: '400px' }}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <p className="text-xs" style={{ color: UI_COLORS.text.muted }}>No preview available for this file.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {patientFiles.length === 0 ? (
                    <p className="text-sm" style={{ color: UI_COLORS.text.muted }}>No patient information files uploaded.</p>
                  ) : (
                    patientFiles.map((file) => (
                      <div
                        key={file.id}
                        onClick={() => setSelectedPatientFile(file)}
                        className="p-4 rounded-lg cursor-pointer transition-colors"
                        style={{ backgroundColor: UI_COLORS.background.hoverLight }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.background.hover}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.background.hoverLight}
                      >
                        <div className="flex items-start gap-3">
                          <FileText className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: UI_COLORS.text.muted }} />
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm mb-1" style={{ color: UI_COLORS.text.heading }}>
                              {file.filename}
                            </h4>
                            <p className="text-xs" style={{ color: UI_COLORS.text.body }}>
                              {file.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )
            )}
          </div>
        </aside>

        {/* Chat Area */}
        <div 
          className="flex-1 flex flex-col transition-all duration-300 ease-in-out"
          style={{
            marginRight: contentSidebarType ? `${physicalAssessmentWidth}px` : '0px',
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
              <div className="flex items-center justify-center h-full">
                {isAiResponding ? (
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <UserAvatar
                        name={patient.name}
                        imageUrl={patient.imageUrl}
                        size="small"
                      />
                    </div>
                    <div
                      className="rounded-lg rounded-bl-none px-4 py-3"
                      style={{ backgroundColor: UI_COLORS.background.hoverLight }}
                    >
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: UI_COLORS.text.muted, animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: UI_COLORS.text.muted, animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: UI_COLORS.text.muted, animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: UI_COLORS.text.light }}>Start a conversation with the AI patient...</p>
                )}
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
                      {message.sender_type === 'ai' && message.message_content === '' && isAiResponding ? (
                        <div className="flex items-center gap-1 py-1">
                          <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: UI_COLORS.text.muted, animationDelay: '0ms' }} />
                          <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: UI_COLORS.text.muted, animationDelay: '150ms' }} />
                          <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: UI_COLORS.text.muted, animationDelay: '300ms' }} />
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed">{message.message_content}</p>
                      )}
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

          {/* Message Input Area — only shown when session is active */}
          {sessionStatus === 'active' && (
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
                    disabled={!inputMessage.trim() || isAiResponding || !sessionId}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Generating Debrief indicator */}
          {sessionStatus === 'generating_debrief' && (
            <div className="p-8 flex items-center justify-center" style={{ borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: UI_COLORS.border.default }}>
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: UI_COLORS.text.muted }} />
                <p className="text-base" style={{ color: UI_COLORS.text.body }}>
                  Generating debrief...
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Content Sidebar (Case Materials or Physical Assessment) - Slides from right edge */}
        <aside 
          ref={physicalAssessmentRef as React.RefObject<HTMLElement>}
          className="flex flex-col absolute top-0 bottom-0 right-0 z-30 overflow-y-auto"
          aria-hidden={!contentSidebarType}
          style={{ 
            backgroundColor: UI_COLORS.background.white, 
            borderLeftWidth: '1px', 
            borderLeftStyle: 'solid', 
            borderLeftColor: UI_COLORS.border.default,
            width: `${physicalAssessmentWidth}px`,
            transform: contentSidebarType ? 'translateX(0)' : 'translateX(100%)',
            boxShadow: contentSidebarType ? '-4px 0 6px rgba(0, 0, 0, 0.1)' : 'none',
            transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
          }}
        >
          {/* Drag handle for resizing */}
          {contentSidebarType && (
            <div
              onMouseDown={onPhysicalAssessmentDrag}
              style={{
                position: 'absolute',
                top: 0,
                left: -3,
                bottom: 0,
                width: 6,
                cursor: 'col-resize',
                zIndex: 10,
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            />
          )}
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
              <PhysicalAssessmentContent materials={personaMedia} loading={personaMediaLoading} />
            )}
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}

export default StudentChatPage;
