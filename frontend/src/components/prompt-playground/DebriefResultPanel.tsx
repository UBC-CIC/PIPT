import { Star, CheckCircle } from 'lucide-react';
import { UI_COLORS } from '@/lib/colors';
import { type AIDebriefData } from '@/services/studentService';

interface DebriefResultPanelProps {
  data: AIDebriefData;
  label?: string; // e.g., "Version A" or "Version B"
}

/**
 * DebriefResultPanel Component
 *
 * Renders a debrief result inline (not as a modal) using the same layout
 * and sections as AIDebriefDialog. Used in the Prompt Playground for
 * single-result display and side-by-side comparison mode.
 *
 * Sections rendered:
 * - Interview Summary (with overall score)
 * - Key Questions Successfully Addressed
 * - Key Questions Missed
 * - Suggested Question Rewrites
 * - Recommendations Feedback (strengths + areas for improvement)
 */
function DebriefResultPanel({ data, label }: DebriefResultPanelProps) {
  return (
    <div
      className="rounded-lg space-y-6"
      style={{
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: UI_COLORS.border.default,
        backgroundColor: UI_COLORS.background.white,
      }}
    >
      {/* Header */}
      {label && (
        <div
          className="px-6 pt-5 pb-0"
        >
          <span
            className="text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded"
            style={{
              backgroundColor: UI_COLORS.background.tableHeader,
              color: UI_COLORS.text.muted,
            }}
          >
            {label}
          </span>
        </div>
      )}

      <div className={`px-6 ${label ? 'pt-0' : 'pt-6'} pb-6 space-y-6`}>
        {/* Interview Summary */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5" style={{ color: UI_COLORS.text.heading }} />
            <h3 className="text-lg font-semibold" style={{ color: UI_COLORS.text.heading }}>
              Interview Summary
            </h3>
          </div>
          <p className="text-sm leading-relaxed pl-7" style={{ color: UI_COLORS.text.body }}>
            {data.summary}
          </p>
          {data.overallScore !== undefined && (
            <div className="flex items-center gap-2 pl-7 mt-2">
              <span className="text-sm font-semibold" style={{ color: UI_COLORS.text.heading }}>
                Overall Score:
              </span>
              <span
                className="text-sm font-medium px-2 py-0.5 rounded"
                style={{
                  backgroundColor:
                    data.overallScore >= 70
                      ? '#dcfce7'
                      : data.overallScore >= 50
                        ? '#fef9c3'
                        : '#fee2e2',
                  color:
                    data.overallScore >= 70
                      ? '#166534'
                      : data.overallScore >= 50
                        ? '#854d0e'
                        : '#991b1b',
                }}
              >
                {Math.round(data.overallScore)}%
              </span>
            </div>
          )}
        </div>

        {/* Key Questions Successfully Addressed */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5" style={{ color: UI_COLORS.text.heading }} />
            <h3 className="text-lg font-semibold" style={{ color: UI_COLORS.text.heading }}>
              Key Questions Successfully Addressed
            </h3>
          </div>
          {data.questionsAddressed.length > 0 ? (
            <ul className="space-y-2 pl-7">
              {data.questionsAddressed.map((question, index) => (
                <li key={index} className="flex items-start gap-2 text-sm" style={{ color: UI_COLORS.text.body }}>
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#22c55e' }} />
                  <span>{question}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm italic pl-7" style={{ color: UI_COLORS.text.muted }}>
              No key questions were identified as addressed.
            </p>
          )}
        </div>

        {/* Key Questions Missed */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5" style={{ color: UI_COLORS.text.heading }} />
            <h3 className="text-lg font-semibold" style={{ color: UI_COLORS.text.heading }}>
              You missed {data.missedKeyQuestionsCount} Key Question{data.missedKeyQuestionsCount !== 1 ? 's' : ''}
            </h3>
          </div>
          {data.missedQuestionsGuidance && (
            <p className="text-sm pl-7" style={{ color: UI_COLORS.text.body }}>
              {data.missedQuestionsGuidance}
            </p>
          )}
        </div>

        {/* Suggested Question Rewrites */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5" style={{ color: UI_COLORS.text.heading }} />
            <h3 className="text-lg font-semibold" style={{ color: UI_COLORS.text.heading }}>
              Suggested Question Rewrites
            </h3>
          </div>
          {data.suggestedRewrites.length > 0 ? (
            <div className="pl-7 space-y-3">
              {data.suggestedRewrites.map((rewrite, index) => (
                <div key={index} className="space-y-1">
                  <p className="text-sm" style={{ color: UI_COLORS.text.body }}>
                    <span className="font-medium">Instead of:</span> &ldquo;{rewrite.original}&rdquo;
                  </p>
                  <p className="text-sm" style={{ color: UI_COLORS.text.body }}>
                    <span className="font-medium">Try:</span> &ldquo;{rewrite.suggested}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm italic pl-7" style={{ color: UI_COLORS.text.muted }}>
              No suggested question rewrites.
            </p>
          )}
        </div>

        {/* Recommendation Feedback */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5" style={{ color: UI_COLORS.text.heading }} />
            <h3 className="text-lg font-semibold" style={{ color: UI_COLORS.text.heading }}>
              Recommendations Feedback
            </h3>
          </div>
          {data.recommendationFeedback.strengths.length === 0 &&
          data.recommendationFeedback.areasForImprovement.length === 0 ? (
            <p className="text-sm italic pl-7" style={{ color: UI_COLORS.text.muted }}>
              No recommendations feedback available.
            </p>
          ) : (
            <div className="pl-7 space-y-4">
              {data.recommendationFeedback.strengths.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>
                    Strengths:
                  </h4>
                  <ul className="space-y-1 list-disc list-inside">
                    {data.recommendationFeedback.strengths.map((strength, index) => (
                      <li key={index} className="text-sm" style={{ color: UI_COLORS.text.body }}>
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data.recommendationFeedback.areasForImprovement.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>
                    Areas for Improvement:
                  </h4>
                  <ul className="space-y-1 list-disc list-inside">
                    {data.recommendationFeedback.areasForImprovement.map((area, index) => (
                      <li key={index} className="text-sm" style={{ color: UI_COLORS.text.body }}>
                        {area}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DebriefResultPanel;
