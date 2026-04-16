import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Loader2, RefreshCw } from 'lucide-react';
import { UI_COLORS } from '@/lib/colors';
import { instructorService, type CompletedSession } from '@/services/instructorService';

interface SessionPickerProps {
  simulationGroupId: string;
  onSessionSelect: (session: CompletedSession) => void;
  selectedSession: CompletedSession | null;
}

/**
 * SessionPicker Component
 *
 * Dropdown that lists completed chat sessions in a simulation group.
 * Fetches sessions on mount and displays student name, persona name, and date.
 */
function SessionPicker({ simulationGroupId, onSessionSelect, selectedSession }: SessionPickerProps) {
  const [sessions, setSessions] = useState<CompletedSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchSessions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await instructorService.getCompletedSessions(simulationGroupId);
      setSessions(data);
    } catch {
      setError('Unable to load sessions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [simulationGroupId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDate = (isoString: string): string => {
    try {
      return new Date(isoString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const handleSelect = (session: CompletedSession) => {
    onSessionSelect(session);
    setIsOpen(false);
  };

  if (error) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium" style={{ color: UI_COLORS.text.heading }}>
          Select Session
        </label>
        <div
          className="flex items-center justify-between px-4 py-3 rounded-md text-sm"
          style={{
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: UI_COLORS.status.error,
            backgroundColor: UI_COLORS.background.white,
            color: UI_COLORS.status.error,
          }}
        >
          <span>{error}</span>
          <button
            onClick={fetchSessions}
            className="p-1 rounded transition-colors hover:bg-gray-100"
            aria-label="Retry loading sessions"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2" ref={dropdownRef}>
      <label className="text-sm font-medium" style={{ color: UI_COLORS.text.heading }}>
        Select Session
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => !isLoading && setIsOpen(!isOpen)}
          disabled={isLoading}
          className="w-full flex items-center justify-between px-4 py-3 rounded-md text-sm text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: UI_COLORS.border.default,
            backgroundColor: UI_COLORS.background.white,
            color: selectedSession ? UI_COLORS.text.heading : UI_COLORS.text.muted,
          }}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading sessions...
            </span>
          ) : selectedSession ? (
            <span className="truncate">
              {selectedSession.studentName} — {selectedSession.personaName} ({formatDate(selectedSession.lastAccessed)})
            </span>
          ) : (
            <span>Select a completed session...</span>
          )}
          <ChevronDown
            className="w-4 h-4 flex-shrink-0 ml-2 transition-transform"
            style={{
              color: UI_COLORS.text.muted,
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </button>

        {isOpen && (
          <div
            className="absolute z-50 w-full mt-1 rounded-md shadow-lg overflow-hidden"
            style={{
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: UI_COLORS.border.default,
              backgroundColor: UI_COLORS.background.white,
            }}
            role="listbox"
          >
            {sessions.length === 0 ? (
              <div
                className="px-4 py-3 text-sm italic"
                style={{ color: UI_COLORS.text.muted }}
              >
                No completed sessions available
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto">
                {sessions.map((session) => (
                  <button
                    key={session.chatId}
                    type="button"
                    onClick={() => handleSelect(session)}
                    className="w-full text-left px-4 py-3 text-sm transition-colors hover:bg-gray-50"
                    style={{
                      color: UI_COLORS.text.heading,
                      backgroundColor:
                        selectedSession?.chatId === session.chatId
                          ? UI_COLORS.background.tableHeader
                          : UI_COLORS.background.white,
                    }}
                    role="option"
                    aria-selected={selectedSession?.chatId === session.chatId}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">
                        {session.studentName}
                      </span>
                      <span
                        className="text-xs flex-shrink-0 ml-2"
                        style={{ color: UI_COLORS.text.muted }}
                      >
                        {formatDate(session.lastAccessed)}
                      </span>
                    </div>
                    <div
                      className="text-xs mt-0.5"
                      style={{ color: UI_COLORS.text.muted }}
                    >
                      {session.personaName}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SessionPicker;
