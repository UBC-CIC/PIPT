import { useState, useCallback, useRef, useEffect } from 'react';
import { Play, Loader2, AlertCircle, RotateCcw, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { UI_COLORS } from '@/lib/colors';
import { instructorService, type ManageablePatient } from '@/services/instructorService';

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
}

interface SystemPromptPlaygroundProps {
  simulationGroupId: string;
  currentSystemPrompt: string;
}

/**
 * SystemPromptPlayground Component
 *
 * Lets instructors test both the system prompt and patient prompt by chatting
 * with a persona in real time. When a persona is selected, the patient prompt
 * editor is pre-populated with that persona's saved prompt. Both prompts are
 * sent on every message. Nothing is persisted.
 */
function SystemPromptPlayground({ simulationGroupId, currentSystemPrompt }: SystemPromptPlaygroundProps) {
  const [personas, setPersonas] = useState<ManageablePatient[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<ManageablePatient | null>(null);
  const [playgroundPrompt, setPlaygroundPrompt] = useState<string>(currentSystemPrompt);
  const [patientPrompt, setPatientPrompt] = useState<string>('');
  const [originalPatientPrompt, setOriginalPatientPrompt] = useState<string>('');

  // Sync playground prompt when the parent's saved prompt changes
  useEffect(() => {
    setPlaygroundPrompt(currentSystemPrompt);
  }, [currentSystemPrompt]);  const [showPatientPrompt, setShowPatientPrompt] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatStarted, setChatStarted] = useState(false);
  const [sessionId, setSessionId] = useState(() => `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasSystemPromptChanges = playgroundPrompt !== currentSystemPrompt;
  const hasPatientPromptChanges = patientPrompt !== originalPatientPrompt;

  // Load personas for the simulation group
  useEffect(() => {
    if (!simulationGroupId) return;
    (async () => {
      try {
        const data = await instructorService.getManageablePatients(simulationGroupId);
        setPersonas(data);
      } catch (err) {
        console.error('Failed to load personas:', err);
      }
    })();
  }, [simulationGroupId]);

  // Pre-populate patient prompt when persona is selected
  useEffect(() => {
    if (selectedPersona) {
      setPatientPrompt(selectedPersona.patient_prompt || '');
      setOriginalPatientPrompt(selectedPersona.patient_prompt || '');
    } else {
      setPatientPrompt('');
      setOriginalPatientPrompt('');
    }
  }, [selectedPersona]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input after AI responds
  useEffect(() => {
    if (chatStarted && !isLoading) {
      inputRef.current?.focus();
    }
  }, [chatStarted, isLoading]);

  const handleStartChat = useCallback(async () => {
    if (!selectedPersona || playgroundPrompt.trim() === '') return;

    setIsStarting(true);
    setError(null);
    setMessages([]);

    try {
      const result = await instructorService.runTestChat({
        simulationGroupId,
        sessionId,
        personaId: selectedPersona.patient_id,
        systemPrompt: playgroundPrompt,
        messageContent: '', // Empty = initial greeting
        patientPrompt: hasPatientPromptChanges ? patientPrompt : undefined,
      });

      setMessages([{ role: 'ai', content: result.llm_output }]);
      setChatStarted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start test chat. Please try again.');
    } finally {
      setIsStarting(false);
    }
  }, [selectedPersona, playgroundPrompt, patientPrompt, hasPatientPromptChanges, simulationGroupId, sessionId]);

  const handleSendMessage = useCallback(async () => {
    if (!selectedPersona || !inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setError(null);

    try {
      const result = await instructorService.runTestChat({
        simulationGroupId,
        sessionId,
        personaId: selectedPersona.patient_id,
        systemPrompt: playgroundPrompt,
        messageContent: userMessage,
        patientPrompt: hasPatientPromptChanges ? patientPrompt : undefined,
      });

      setMessages(prev => [...prev, { role: 'ai', content: result.llm_output }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedPersona, inputMessage, isLoading, playgroundPrompt, patientPrompt, hasPatientPromptChanges, simulationGroupId, sessionId]);

  const handleReset = useCallback(() => {
    setMessages([]);
    setChatStarted(false);
    setError(null);
    setInputMessage('');
    setSessionId(`test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const isStartDisabled = !selectedPersona || playgroundPrompt.trim() === '' || isStarting;

  return (
    <div
      className="rounded-lg space-y-6 p-6"
      style={{
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: UI_COLORS.border.default,
        backgroundColor: UI_COLORS.background.white,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-semibold" style={{ color: UI_COLORS.text.heading }}>
            System Prompt Playground
          </h2>
          {hasSystemPromptChanges && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: '#fef9c3', color: '#854d0e' }}
            >
              System prompt modified
            </span>
          )}
          {hasPatientPromptChanges && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: '#dbeafe', color: '#1e40af' }}
            >
              Patient prompt modified
            </span>
          )}
        </div>
        {chatStarted && (
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            style={{
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: UI_COLORS.border.default,
              color: UI_COLORS.text.heading,
              backgroundColor: UI_COLORS.background.white,
            }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Chat
          </button>
        )}
      </div>

      {/* Persona Picker */}
      <div className="space-y-2">
        <label className="text-sm font-medium" style={{ color: UI_COLORS.text.heading }}>
          Select Persona
        </label>
        <select
          value={selectedPersona?.patient_id || ''}
          onChange={(e) => {
            const persona = personas.find(p => p.patient_id === e.target.value) || null;
            setSelectedPersona(persona);
            if (chatStarted) handleReset();
          }}
          className="w-full px-3 py-2 rounded-md text-sm"
          style={{
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: UI_COLORS.border.default,
            backgroundColor: UI_COLORS.background.input,
            color: UI_COLORS.text.body,
          }}
          disabled={chatStarted}
        >
          <option value="">Choose a persona to chat with...</option>
          {personas.map(p => (
            <option key={p.patient_id} value={p.patient_id}>
              {p.patient_name} — {p.patient_age}y/o {p.patient_gender}
            </option>
          ))}
        </select>
        {personas.length === 0 && (
          <p className="text-xs" style={{ color: UI_COLORS.text.muted }}>
            No personas found. Create a persona first.
          </p>
        )}
      </div>

      {/* Prompt Editors — hidden once chat starts */}
      {!chatStarted && (
        <>
          {/* System Prompt */}
          <div className="space-y-2">
            <label
              className="text-sm font-medium"
              style={{ color: UI_COLORS.text.heading }}
              htmlFor="system-playground-prompt"
            >
              System Prompt
            </label>
            <textarea
              id="system-playground-prompt"
              value={playgroundPrompt}
              onChange={(e) => setPlaygroundPrompt(e.target.value)}
              rows={6}
              className="w-full px-4 py-3 rounded-md text-sm leading-relaxed resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: UI_COLORS.border.default,
                backgroundColor: UI_COLORS.background.input,
                color: UI_COLORS.text.body,
              }}
              placeholder="Enter your system prompt here..."
            />
          </div>

          {/* Patient Prompt — collapsible, shown when a persona is selected */}
          {selectedPersona && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowPatientPrompt(!showPatientPrompt)}
                className="flex items-center gap-1.5 text-sm font-medium transition-colors"
                style={{ color: UI_COLORS.text.heading }}
              >
                {showPatientPrompt ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Patient Prompt — {selectedPersona.patient_name}
                {hasPatientPromptChanges && (
                  <span className="text-xs font-normal" style={{ color: '#1e40af' }}>(modified)</span>
                )}
              </button>
              {showPatientPrompt && (
                <>
                  <textarea
                    id="patient-playground-prompt"
                    value={patientPrompt}
                    onChange={(e) => setPatientPrompt(e.target.value)}
                    rows={6}
                    className="w-full px-4 py-3 rounded-md text-sm leading-relaxed resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    style={{
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: hasPatientPromptChanges ? '#93c5fd' : UI_COLORS.border.default,
                      backgroundColor: UI_COLORS.background.input,
                      color: UI_COLORS.text.body,
                    }}
                    placeholder="Enter the patient-specific prompt here..."
                  />
                  {hasPatientPromptChanges && (
                    <button
                      type="button"
                      onClick={() => setPatientPrompt(originalPatientPrompt)}
                      className="text-xs underline"
                      style={{ color: UI_COLORS.text.muted }}
                    >
                      Reset to saved prompt
                    </button>
                  )}
                  <p className="text-xs" style={{ color: UI_COLORS.text.muted }}>
                    This is the persona-specific prompt. Edit it here to test changes — the saved version won't be affected.
                  </p>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Start Chat Button — shown before chat starts */}
      {!chatStarted && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleStartChat}
            disabled={isStartDisabled}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: UI_COLORS.button.primary,
              color: UI_COLORS.button.text,
            }}
            onMouseEnter={(e) => {
              if (!isStartDisabled) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = UI_COLORS.button.primaryHover;
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = UI_COLORS.button.primary;
            }}
          >
            {isStarting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting Chat...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start Test Chat
              </>
            )}
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div
          className="flex items-start gap-2 px-4 py-3 rounded-md text-sm"
          role="alert"
          style={{
            backgroundColor: '#fef2f2',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: '#fecaca',
            color: '#991b1b',
          }}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Chat Messages */}
      {chatStarted && (
        <div
          className="rounded-lg overflow-hidden"
          style={{
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: UI_COLORS.border.default,
          }}
        >
          {/* Chat header */}
          <div
            className="px-4 py-3 text-sm font-medium"
            style={{
              backgroundColor: UI_COLORS.background.tableHeader,
              color: UI_COLORS.text.heading,
              borderBottomWidth: '1px',
              borderBottomStyle: 'solid',
              borderBottomColor: UI_COLORS.border.default,
            }}
          >
            Chatting with {selectedPersona?.patient_name || 'Persona'}
            <span className="ml-2 text-xs font-normal" style={{ color: UI_COLORS.text.muted }}>
              (using custom prompts — not persisted)
            </span>
          </div>

          {/* Messages area */}
          <div
            className="p-4 space-y-4 overflow-y-auto"
            style={{
              maxHeight: '400px',
              backgroundColor: UI_COLORS.background.page,
            }}
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className="max-w-[80%] px-4 py-3 rounded-lg text-sm leading-relaxed whitespace-pre-wrap"
                  style={{
                    backgroundColor: msg.role === 'user' ? UI_COLORS.button.primary : UI_COLORS.background.white,
                    color: msg.role === 'user' ? UI_COLORS.button.text : UI_COLORS.text.body,
                    borderWidth: msg.role === 'ai' ? '1px' : '0',
                    borderStyle: 'solid',
                    borderColor: UI_COLORS.border.default,
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div
                  className="px-4 py-3 rounded-lg text-sm flex items-center gap-2"
                  style={{
                    backgroundColor: UI_COLORS.background.white,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: UI_COLORS.border.default,
                    color: UI_COLORS.text.muted,
                  }}
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Thinking...
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input area */}
          <div
            className="flex items-center gap-2 px-4 py-3"
            style={{
              borderTopWidth: '1px',
              borderTopStyle: 'solid',
              borderTopColor: UI_COLORS.border.default,
              backgroundColor: UI_COLORS.background.white,
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={isLoading}
              className="flex-1 px-3 py-2 rounded-md text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: UI_COLORS.border.default,
                backgroundColor: UI_COLORS.background.input,
                color: UI_COLORS.text.body,
              }}
            />
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: UI_COLORS.button.primary,
                color: UI_COLORS.button.text,
              }}
              onMouseEnter={(e) => {
                if (inputMessage.trim() && !isLoading) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = UI_COLORS.button.primaryHover;
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = UI_COLORS.button.primary;
              }}
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SystemPromptPlayground;
