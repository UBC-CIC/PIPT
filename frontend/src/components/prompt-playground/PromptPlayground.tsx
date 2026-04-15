import { useState, useCallback } from 'react';
import { Play, GitCompare, Loader2, AlertCircle, Circle } from 'lucide-react';
import { UI_COLORS } from '@/lib/colors';
import { instructorService, type CompletedSession } from '@/services/instructorService';
import { type AIDebriefData } from '@/services/studentService';
import SessionPicker from './SessionPicker';
import DebriefResultPanel from './DebriefResultPanel';
import ComparisonView from './ComparisonView';

interface PromptPlaygroundProps {
  simulationGroupId: string;
  currentDebriefPrompt: string;
}

/**
 * PromptPlayground Component
 *
 * Orchestrates the prompt testing workflow: session selection, prompt editing,
 * test execution, result display, and side-by-side comparison. The prompt
 * editor is pre-populated with the current saved debrief prompt and tracks
 * unsaved changes. Results are ephemeral — held in component state only.
 */
function PromptPlayground({ simulationGroupId, currentDebriefPrompt }: PromptPlaygroundProps) {
  const [selectedSession, setSelectedSession] = useState<CompletedSession | null>(null);
  const [playgroundPrompt, setPlaygroundPrompt] = useState<string>(currentDebriefPrompt);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultA, setResultA] = useState<AIDebriefData | null>(null);
  const [resultB, setResultB] = useState<AIDebriefData | null>(null);
  const [isCompareMode, setIsCompareMode] = useState(false);

  const hasUnsavedChanges = playgroundPrompt !== currentDebriefPrompt;
  const isTestDisabled = !selectedSession || playgroundPrompt.trim() === '' || isLoading;

  const handleRunTest = useCallback(async () => {
    if (!selectedSession || playgroundPrompt.trim() === '') return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await instructorService.runTestDebrief({
        simulationGroupId,
        sessionId: selectedSession.chatId,
        personaId: selectedSession.personaId,
        debriefPrompt: playgroundPrompt,
      });

      if (isCompareMode && resultA && !resultB) {
        // In compare mode with first result already stored, set as second result
        setResultB(result);
      } else if (isCompareMode && resultA && resultB) {
        // Both slots filled — shift B out, new result becomes B
        setResultB(result);
      } else {
        // Single mode or first result in compare mode
        setResultA(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test debrief failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedSession, playgroundPrompt, simulationGroupId, isCompareMode, resultA, resultB]);

  const handleToggleCompare = useCallback(() => {
    if (!isCompareMode) {
      // Entering compare mode — keep resultA, clear resultB
      setIsCompareMode(true);
      setResultB(null);
    } else {
      // Exiting compare mode — keep resultA, discard resultB
      setIsCompareMode(false);
      setResultB(null);
    }
  }, [isCompareMode]);

  const handleExitComparison = useCallback(() => {
    setIsCompareMode(false);
    setResultB(null);
  }, []);

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
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold" style={{ color: UI_COLORS.text.heading }}>
            Prompt Playground
          </h2>
          {hasUnsavedChanges && (
            <span
              className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
              data-testid="unsaved-indicator"
              style={{
                backgroundColor: '#fef9c3',
                color: '#854d0e',
              }}
            >
              <Circle className="w-2 h-2 fill-current" />
              Unsaved changes
            </span>
          )}
        </div>
      </div>

      {/* Session Picker */}
      <SessionPicker
        simulationGroupId={simulationGroupId}
        onSessionSelect={setSelectedSession}
        selectedSession={selectedSession}
      />

      {/* Prompt Editor */}
      <div className="space-y-2">
        <label
          className="text-sm font-medium"
          style={{ color: UI_COLORS.text.heading }}
          htmlFor="playground-prompt"
        >
          Debrief Prompt
        </label>
        <textarea
          id="playground-prompt"
          value={playgroundPrompt}
          onChange={(e) => setPlaygroundPrompt(e.target.value)}
          rows={8}
          className="w-full px-4 py-3 rounded-md text-sm leading-relaxed resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: UI_COLORS.border.default,
            backgroundColor: UI_COLORS.background.input,
            color: UI_COLORS.text.body,
          }}
          placeholder="Enter your debrief prompt here..."
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleRunTest}
          disabled={isTestDisabled}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: isTestDisabled ? UI_COLORS.button.primary : UI_COLORS.button.primary,
            color: UI_COLORS.button.text,
          }}
          onMouseEnter={(e) => {
            if (!isTestDisabled) {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = UI_COLORS.button.primaryHover;
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = UI_COLORS.button.primary;
          }}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running Test...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Test
            </>
          )}
        </button>

        {resultA && (
          <button
            type="button"
            onClick={handleToggleCompare}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
            style={{
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: UI_COLORS.border.default,
              backgroundColor: isCompareMode ? UI_COLORS.background.tableHeader : UI_COLORS.background.white,
              color: UI_COLORS.text.heading,
            }}
          >
            <GitCompare className="w-4 h-4" />
            {isCompareMode ? 'Exit Compare' : 'Compare'}
          </button>
        )}
      </div>

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

      {/* Loading Indicator */}
      {isLoading && (
        <div
          className="flex items-center justify-center gap-2 py-8 text-sm"
          style={{ color: UI_COLORS.text.muted }}
        >
          <Loader2 className="w-5 h-5 animate-spin" />
          Generating test debrief...
        </div>
      )}

      {/* Results Display */}
      {!isLoading && isCompareMode && resultA && resultB ? (
        <ComparisonView
          resultA={resultA}
          resultB={resultB}
          onExit={handleExitComparison}
        />
      ) : !isLoading && isCompareMode && resultA && !resultB ? (
        <div className="space-y-4">
          <div
            className="px-4 py-3 rounded-md text-sm"
            style={{
              backgroundColor: UI_COLORS.background.tableHeader,
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: UI_COLORS.border.default,
              color: UI_COLORS.text.muted,
            }}
          >
            Version A result stored. Edit the prompt and click "Test" to generate Version B for comparison.
          </div>
          <DebriefResultPanel data={resultA} label="Version A" />
        </div>
      ) : !isLoading && resultA ? (
        <DebriefResultPanel data={resultA} />
      ) : null}
    </div>
  );
}

export default PromptPlayground;
