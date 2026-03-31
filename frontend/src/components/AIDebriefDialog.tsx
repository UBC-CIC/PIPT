import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Star, CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { UI_COLORS } from '@/lib/colors';
import { useState, useEffect } from 'react';
import { studentService, type AIDebriefData } from '@/services/studentService';

interface AIDebriefDialogProps {
  isOpen: boolean;
  onClose: () => void;
  data?: AIDebriefData | null;
  simulationGroupId?: string;
  patientId?: string;
}

/**
 * AIDebriefDialog Component
 * 
 * Displays comprehensive AI-generated feedback on the student's clinical interview performance.
 * Includes interview summary, key questions addressed/missed, clinical reasoning feedback,
 * and suggested question rewrites.
 */
function AIDebriefDialog({ isOpen, onClose, data, simulationGroupId, patientId }: AIDebriefDialogProps) {
  const [feedbackComment, setFeedbackComment] = useState('');
  const [isLoadingAnswerKey, setIsLoadingAnswerKey] = useState(false);
  const [answerKeyAvailable, setAnswerKeyAvailable] = useState<boolean | null>(null);

  // Check if an answer key file actually exists when the dialog opens
  useEffect(() => {
    if (isOpen && simulationGroupId && patientId) {
      setAnswerKeyAvailable(null);
      studentService.fetchAnswerKeyUrl(simulationGroupId, patientId).then((url) => {
        setAnswerKeyAvailable(!!url);
      }).catch(() => {
        setAnswerKeyAvailable(false);
      });
    }
  }, [isOpen, simulationGroupId, patientId]);

  // Use provided data or show empty state
  const debriefData = data || {
    summary: '',
    questionsAddressed: [],
    missedKeyQuestionsCount: 0,
    missedQuestions: [],
    missedQuestionsGuidance: '',
    recommendationFeedback: { strengths: [], areasForImprovement: [] },
    suggestedRewrites: [],
    rubricDescription: '',
  };

  const handleFeedbackSubmit = (helpful: boolean) => {
    console.log('Feedback submitted:', { helpful, comment: feedbackComment });
    // Future: Send feedback to backend
  };

  const handleCommentSubmit = () => {
    console.log('Comment submitted:', { comment: feedbackComment });
    // Future: Send comment to backend
    setFeedbackComment('');
  };

  const handleViewAnswerKey = async () => {
    if (!simulationGroupId || !patientId) return;
    setIsLoadingAnswerKey(true);
    try {
      const url = await studentService.fetchAnswerKeyUrl(simulationGroupId, patientId);
      if (url) {
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('Failed to open answer key:', error);
    } finally {
      setIsLoadingAnswerKey(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 rounded-lg"
        style={{ backgroundColor: UI_COLORS.background.white }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b" style={{ backgroundColor: UI_COLORS.background.white, borderColor: UI_COLORS.border.default }}>
          <h2 className="text-2xl font-bold" style={{ color: UI_COLORS.text.heading }}>
            AI Debrief
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full transition-colors hover:bg-gray-100"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" style={{ color: UI_COLORS.text.body }} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-base" style={{ color: UI_COLORS.text.body }}>
            Summary and feedback on your clinical interview.
          </p>

          {/* Interview Summary */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5" style={{ color: UI_COLORS.text.heading }} />
              <h3 className="text-lg font-semibold" style={{ color: UI_COLORS.text.heading }}>
                Interview Summary
              </h3>
            </div>
            <p className="text-sm leading-relaxed pl-7" style={{ color: UI_COLORS.text.body }}>
              {debriefData.summary}
            </p>
            {debriefData.overallScore !== undefined && (
              <div className="flex items-center gap-2 pl-7 mt-2">
                <span className="text-sm font-semibold" style={{ color: UI_COLORS.text.heading }}>
                  Overall Score:
                </span>
                <span
                  className="text-sm font-medium px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: debriefData.overallScore >= 70 ? '#dcfce7' : debriefData.overallScore >= 50 ? '#fef9c3' : '#fee2e2',
                    color: debriefData.overallScore >= 70 ? '#166534' : debriefData.overallScore >= 50 ? '#854d0e' : '#991b1b',
                  }}
                >
                  {debriefData.overallScore}%
                </span>
              </div>
            )}
          </div>

          {/* Key Questions Successfully Addressed */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5" style={{ color: UI_COLORS.text.heading }} />
              <h3 className="text-lg font-semibold" style={{ color: UI_COLORS.text.heading }}>
                Key Questions You Successfully Addressed
              </h3>
            </div>
            <ul className="space-y-2 pl-7">
              {debriefData.questionsAddressed.map((question, index) => (
                <li key={index} className="flex items-start gap-2 text-sm" style={{ color: UI_COLORS.text.body }}>
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#22c55e' }} />
                  <span>{question}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Key Questions Missed */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5" style={{ color: UI_COLORS.text.heading }} />
              <h3 className="text-lg font-semibold" style={{ color: UI_COLORS.text.heading }}>
                You missed {debriefData.missedKeyQuestionsCount} Key Question{debriefData.missedKeyQuestionsCount !== 1 ? 's' : ''}
              </h3>
            </div>
            {debriefData.missedQuestionsGuidance && (
              <p className="text-sm pl-7" style={{ color: UI_COLORS.text.body }}>
                {debriefData.missedQuestionsGuidance}
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
            <div className="pl-7 space-y-3">
              {debriefData.suggestedRewrites.map((rewrite, index) => (
                <div key={index} className="space-y-1">
                  <p className="text-sm" style={{ color: UI_COLORS.text.body }}>
                    <span className="font-medium">Instead of:</span> "{rewrite.original}"
                  </p>
                  <p className="text-sm" style={{ color: UI_COLORS.text.body }}>
                    <span className="font-medium">Try:</span> "{rewrite.suggested}"
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendation Feedback */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5" style={{ color: UI_COLORS.text.heading }} />
              <h3 className="text-lg font-semibold" style={{ color: UI_COLORS.text.heading }}>
                Recommendations Feedback
              </h3>
            </div>
            <div className="pl-7 space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>
                  Strengths:
                </h4>
                <ul className="space-y-1 list-disc list-inside">
                  {debriefData.recommendationFeedback.strengths.map((strength, index) => (
                    <li key={index} className="text-sm" style={{ color: UI_COLORS.text.body }}>
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>
                  Areas for Improvement:
                </h4>
                <ul className="space-y-1 list-disc list-inside">
                  {debriefData.recommendationFeedback.areasForImprovement.map((area, index) => (
                    <li key={index} className="text-sm" style={{ color: UI_COLORS.text.body }}>
                      {area}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Answer Key */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5" style={{ color: UI_COLORS.text.heading }} />
              <h3 className="text-lg font-semibold" style={{ color: UI_COLORS.text.heading }}>
                Answer Key
              </h3>
            </div>
            <div className="pl-7 flex items-start justify-between gap-4">
              <p className="text-sm flex-1" style={{ color: UI_COLORS.text.body }}>
                {debriefData.rubricDescription}
              </p>
              <Button
                onClick={handleViewAnswerKey}
                disabled={answerKeyAvailable !== true || isLoadingAnswerKey}
                variant="outline"
                className="px-6 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: UI_COLORS.background.white,
                  color: UI_COLORS.text.heading,
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: UI_COLORS.border.default,
                }}
              >
                {isLoadingAnswerKey ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'View Answer Key'
                )}
              </Button>
            </div>
          </div>

          {/* Answer Key Comparison */}
          {debriefData.answerKeyComparison && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5" style={{ color: UI_COLORS.text.heading }} />
                <h3 className="text-lg font-semibold" style={{ color: UI_COLORS.text.heading }}>
                  Answer Key Comparison
                </h3>
              </div>
              <div className="pl-7">
                {debriefData.answerKeyComparison.answerKeyAvailable ? (
                  <div className="space-y-4">
                    {/* Overall Alignment */}
                    {debriefData.answerKeyComparison.overallAlignment && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold" style={{ color: UI_COLORS.text.heading }}>
                          Overall Alignment:
                        </span>
                        <span
                          className="text-sm font-medium px-2 py-0.5 rounded"
                          style={{
                            backgroundColor:
                              debriefData.answerKeyComparison.overallAlignment === 'Strong'
                                ? '#dcfce7'
                                : debriefData.answerKeyComparison.overallAlignment === 'Partial'
                                  ? '#fef9c3'
                                  : '#fee2e2',
                            color:
                              debriefData.answerKeyComparison.overallAlignment === 'Strong'
                                ? '#166534'
                                : debriefData.answerKeyComparison.overallAlignment === 'Partial'
                                  ? '#854d0e'
                                  : '#991b1b',
                          }}
                        >
                          {debriefData.answerKeyComparison.overallAlignment}
                        </span>
                      </div>
                    )}

                    {/* Correct Elements */}
                    {debriefData.answerKeyComparison.correctElements && debriefData.answerKeyComparison.correctElements.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>
                          Correct Elements:
                        </h4>
                        <ul className="space-y-1">
                          {debriefData.answerKeyComparison.correctElements.map((element, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm" style={{ color: UI_COLORS.text.body }}>
                              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#22c55e' }} />
                              <span>{element}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Missing Elements */}
                    {debriefData.answerKeyComparison.missingElements && debriefData.answerKeyComparison.missingElements.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>
                          Missing Elements:
                        </h4>
                        <ul className="space-y-1">
                          {debriefData.answerKeyComparison.missingElements.map((element, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm" style={{ color: '#854d0e' }}>
                              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#eab308' }} />
                              <span>{element}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Incorrect Elements */}
                    {debriefData.answerKeyComparison.incorrectElements && debriefData.answerKeyComparison.incorrectElements.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>
                          Incorrect Elements:
                        </h4>
                        <ul className="space-y-1">
                          {debriefData.answerKeyComparison.incorrectElements.map((element, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm" style={{ color: '#991b1b' }}>
                              <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#ef4444' }} />
                              <span>{element}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm italic" style={{ color: UI_COLORS.text.body }}>
                    No answer key was provided for this simulation case.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Feedback Section */}
          <div className="pt-6 border-t space-y-4" style={{ borderColor: UI_COLORS.border.default }}>
            <div className="flex items-center gap-4">
              <p className="text-sm font-medium italic" style={{ color: UI_COLORS.text.heading }}>
                Was this feedback helpful?
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleFeedbackSubmit(true)}
                  className="px-6 transition-colors"
                  style={{ backgroundColor: UI_COLORS.text.heading, color: UI_COLORS.button.text }}
                >
                  Yes
                </Button>
                <Button
                  onClick={() => handleFeedbackSubmit(false)}
                  className="px-6 transition-colors"
                  style={{ backgroundColor: UI_COLORS.text.heading, color: UI_COLORS.button.text }}
                >
                  No
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="Optional comment:"
                className="flex-1 px-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
                style={{
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: UI_COLORS.border.default,
                  outlineColor: UI_COLORS.border.medium,
                }}
              />
              <Button
                onClick={handleCommentSubmit}
                disabled={!feedbackComment.trim()}
                className="px-6 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
              >
                Submit
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AIDebriefDialog;
