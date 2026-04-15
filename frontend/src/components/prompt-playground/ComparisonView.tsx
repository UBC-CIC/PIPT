import { X } from 'lucide-react';
import { UI_COLORS } from '@/lib/colors';
import { type AIDebriefData } from '@/services/studentService';
import DebriefResultPanel from './DebriefResultPanel';

interface ComparisonViewProps {
  resultA: AIDebriefData;
  resultB: AIDebriefData;
  onExit: () => void;
}

/**
 * ComparisonView Component
 *
 * Renders two DebriefResultPanel components side by side so admins can
 * compare debrief outputs from different prompt versions. Highlights
 * the overall score difference between the two results and provides
 * an "Exit Comparison" button to return to single-result view.
 */
function ComparisonView({ resultA, resultB, onExit }: ComparisonViewProps) {
  const scoreA = resultA.overallScore;
  const scoreB = resultB.overallScore;
  const bothScoresAvailable = scoreA !== undefined && scoreB !== undefined;
  const scoreDiff = bothScoresAvailable ? Math.round(scoreB) - Math.round(scoreA) : null;

  return (
    <div className="space-y-4">
      {/* Header bar with score summary and exit button */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-lg"
        style={{
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: UI_COLORS.border.default,
          backgroundColor: UI_COLORS.background.tableHeader,
        }}
      >
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold" style={{ color: UI_COLORS.text.heading }}>
            Comparison Mode
          </h3>

          {/* Score difference highlight */}
          {bothScoresAvailable && scoreDiff !== null && (
            <div
              data-testid="score-diff"
              className="flex items-center gap-2 text-sm"
            >
              <span style={{ color: UI_COLORS.text.muted }}>Score difference:</span>
              <span
                className="font-semibold px-2 py-0.5 rounded"
                style={{
                  backgroundColor:
                    scoreDiff > 0
                      ? '#dcfce7'
                      : scoreDiff < 0
                        ? '#fee2e2'
                        : '#f3f4f6',
                  color:
                    scoreDiff > 0
                      ? '#166534'
                      : scoreDiff < 0
                        ? '#991b1b'
                        : UI_COLORS.text.muted,
                }}
              >
                {scoreDiff > 0 ? '+' : ''}{scoreDiff} pts
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-gray-200"
          style={{
            color: UI_COLORS.text.heading,
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: UI_COLORS.border.default,
            backgroundColor: UI_COLORS.background.white,
          }}
        >
          <X className="w-4 h-4" />
          Exit Comparison
        </button>
      </div>

      {/* Side-by-side panels */}
      <div className="grid grid-cols-2 gap-4">
        <DebriefResultPanel data={resultA} label="Version A" />
        <DebriefResultPanel data={resultB} label="Version B" />
      </div>
    </div>
  );
}

export default ComparisonView;
