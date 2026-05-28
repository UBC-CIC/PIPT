import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import UserAvatar from '@/components/UserAvatar';
import LoadingIndicator from '@/components/LoadingIndicator';
import { UI_COLORS, SIMULATION_GROUP_COLOR_PALETTE } from '@/lib/colors';
import type { StudentDetails, StudentPatientData, OrganizationLabels } from '@/services/instructorService';

export interface StudentDetailsPanelProps {
  studentDetails: StudentDetails | null;
  studentDetailsLoading: boolean;
  studentPatientData: StudentPatientData | null;
  expandedAttemptId: string | null;
  onExpandAttempt: (id: string | null) => void;
  selectedPatientFilter: string;
  onPatientFilterChange: (filter: string) => void;
  onViewDebrief: (attemptId: string) => void;
  isFetchingDebrief: string | null;
  onDownloadPdf: (attemptId: string) => void;
  isGeneratingPdf: string | null;
  onBack: () => void;
  attemptPdfRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  labels: OrganizationLabels;
}


export function StudentDetailsPanel({
  studentDetails,
  studentDetailsLoading,
  studentPatientData,
  expandedAttemptId,
  onExpandAttempt,
  selectedPatientFilter,
  onPatientFilterChange,
  onViewDebrief,
  isFetchingDebrief,
  onDownloadPdf,
  isGeneratingPdf,
  onBack,
  attemptPdfRefs,
}: StudentDetailsPanelProps) {
  const [showSubmissionsMap, setShowSubmissionsMap] = useState<Record<string, boolean>>({});

  const handleDownloadNotesTxt = (attemptId: string) => {
    try {
      const notes = studentPatientData?.notes[attemptId] || '';
      const blob = new Blob([notes || 'No notes available.'], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Notes_${attemptId}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download notes:', error);
    }
  };

  return (
    <div className="flex h-full">
      {/* Student View Sidebar */}
      <aside
        className="flex flex-col border-r overflow-y-auto"
        style={{
          backgroundColor: UI_COLORS.background.white,
          borderRightWidth: '1px',
          borderRightStyle: 'solid',
          borderRightColor: UI_COLORS.border.default,
          width: '16rem',
          minWidth: '16rem',
        }}
      >
        <div className="p-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 mb-4 text-sm transition-colors"
            style={{
              color: UI_COLORS.text.body,
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = UI_COLORS.text.heading)}
            onMouseLeave={(e) => (e.currentTarget.style.color = UI_COLORS.text.body)}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to All Students
          </button>
          <h2 className="text-xl font-semibold" style={{ color: UI_COLORS.text.heading }}>
            Overview
          </h2>
        </div>

        <nav className="flex-1 px-6 space-y-4">
          {studentDetailsLoading ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: UI_COLORS.text.muted }}>
              <LoadingIndicator size="sm" message="Loading..." />
            </div>
          ) : studentDetails ? (
            <>
              {[
                { label: 'Student Name', value: studentDetails.name },
                { label: 'Student Email', value: studentDetails.email },
                { label: 'Group Name', value: studentDetails.groupName },
                { label: 'Cases Attempted', value: String(studentDetails.casesAttempted) },
                { label: 'Case Completion Rate', value: `${studentDetails.caseCompletionRate}%` },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs font-medium mb-1" style={{ color: UI_COLORS.text.muted }}>
                    {label}
                  </p>
                  <p className="text-sm" style={{ color: UI_COLORS.text.heading }}>
                    {value}
                  </p>
                </div>
              ))}
            </>
          ) : null}
        </nav>

        <div className="p-6 border-t" style={{ borderColor: UI_COLORS.border.default }}>
          <Button
            className="w-full justify-center gap-2 py-2.5 h-auto font-medium transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed"
            disabled
            title="Unenrollment is not yet available"
            style={{
              backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[0],
              borderColor: SIMULATION_GROUP_COLOR_PALETTE[0],
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Unenroll Student
          </Button>
        </div>
      </aside>

      {/* Chat History Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl space-y-6">
            <h2 className="text-2xl font-semibold" style={{ color: UI_COLORS.text.heading }}>
              Chat History
            </h2>

            {/* Filter by Patient Name */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                Filter by Patient Name:
              </label>
              <select
                value={selectedPatientFilter}
                onChange={(e) => onPatientFilterChange(e.target.value)}
                className="w-full px-4 py-3 rounded-lg text-base"
                style={{
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: UI_COLORS.border.default,
                  backgroundColor: UI_COLORS.background.white,
                  color: UI_COLORS.text.heading,
                }}
              >
                {(studentPatientData?.patientNames || []).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-sm italic" style={{ color: UI_COLORS.text.muted }}>
              Click on the dropdown icon to view the student&apos;s chat history and export per-case reports.
            </p>

            {/* Chat Attempts */}
            <div className="space-y-4">
              {(studentPatientData?.attempts[selectedPatientFilter] || []).map((attempt) => {
                const isExpanded = expandedAttemptId === attempt.id;
                const messages = studentPatientData?.messages[attempt.id] || [];
                const notes = studentPatientData?.notes[attempt.id] || '';
                return (
                  <div
                    key={attempt.id}
                    className="border rounded-lg overflow-hidden"
                    style={{ borderColor: UI_COLORS.border.default }}
                  >
                    {/* Attempt Header Row */}
                    <div
                      className="grid grid-cols-[2fr_2fr_2fr_1fr] gap-4 px-6 py-4 items-center cursor-pointer transition-colors hover:bg-gray-50"
                      style={{
                        backgroundColor: isExpanded
                          ? UI_COLORS.background.tableHeader
                          : UI_COLORS.background.white,
                      }}
                      onClick={() => onExpandAttempt(isExpanded ? null : attempt.id)}
                    >
                      <div className="text-base" style={{ color: UI_COLORS.text.heading }}>
                        {attempt.date}
                      </div>
                      <div className="text-base" style={{ color: UI_COLORS.text.heading }}>
                        {attempt.completionStatus}
                      </div>
                      <div className="flex justify-end">
                        <button
                          className="p-2 rounded transition-transform"
                          style={{
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: 'transparent',
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          }}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M4 6L8 10L12 6"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t" style={{ borderColor: UI_COLORS.border.default }}>
                        {/* ── PDF-captured wrapper: header + chat history only ── */}
                        <div
                          ref={(el) => {
                            attemptPdfRefs.current[String(attempt.id)] = el;
                          }}
                          className="bg-white"
                        >
                          {/* PDF Header */}
                          <div
                            className="px-6 pt-6 pb-2 border-b"
                            style={{ borderColor: UI_COLORS.border.default }}
                          >
                            <h3
                              className="text-lg font-bold mb-1"
                              style={{ color: UI_COLORS.text.heading }}
                            >
                              {studentDetails?.name ?? 'Student'}
                            </h3>
                            <p className="text-sm" style={{ color: UI_COLORS.text.body }}>
                              Patient: {selectedPatientFilter || 'Unknown'}
                            </p>
                            <p className="text-sm" style={{ color: UI_COLORS.text.body }}>
                              Session: {attempt.date}
                            </p>
                          </div>

                          {/* Chat History Section */}
                          <div className="p-6">
                            <h3
                              className="text-lg font-semibold mb-4"
                              style={{ color: UI_COLORS.text.heading }}
                            >
                              Chat History
                            </h3>
                            <div
                              className="border rounded-lg p-4 space-y-4 max-h-96 overflow-y-auto"
                              style={{
                                borderColor: UI_COLORS.border.default,
                                backgroundColor: UI_COLORS.background.white,
                              }}
                            >
                              {messages.length > 0 ? (
                                messages.map((message) => (
                                  <div
                                    key={message.message_id}
                                    className={`flex gap-3 ${
                                      message.sender_type === 'student'
                                        ? 'justify-end'
                                        : 'justify-start'
                                    }`}
                                  >
                                    {message.sender_type !== 'student' && (
                                      <div className="flex-shrink-0">
                                        <UserAvatar
                                          name={selectedPatientFilter || 'Patient'}
                                          imageUrl={undefined}
                                          size="small"
                                        />
                                      </div>
                                    )}
                                    <div
                                      className={`max-w-[70%] rounded-lg px-4 py-3 ${
                                        message.sender_type === 'student'
                                          ? 'rounded-br-none'
                                          : 'rounded-bl-none'
                                      }`}
                                      style={{
                                        backgroundColor:
                                          message.sender_type === 'student'
                                            ? SIMULATION_GROUP_COLOR_PALETTE[2]
                                            : UI_COLORS.background.hoverLight,
                                        color:
                                          message.sender_type === 'student'
                                            ? UI_COLORS.button.text
                                            : UI_COLORS.text.heading,
                                      }}
                                    >
                                      <p className="text-sm font-semibold mb-1">
                                        {message.sender_type === 'student'
                                          ? `${studentDetails?.name || 'Student'} (User)`
                                          : `${selectedPatientFilter || 'Patient'} (LLM)`}
                                        :
                                      </p>
                                      <p className="text-sm">{message.message_content}</p>
                                    </div>
                                    {message.sender_type === 'student' && (
                                      <div className="flex-shrink-0">
                                        <UserAvatar
                                          name={studentDetails?.name || 'Student'}
                                          imageUrl={undefined}
                                          size="small"
                                        />
                                      </div>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <p
                                  className="text-sm italic"
                                  style={{ color: UI_COLORS.text.muted }}
                                >
                                  No chat history available.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* ── End of PDF-captured wrapper ── */}

                        {/* Notes Section (on-screen only, excluded from PDF) */}
                        <div className="px-6 pb-6">
                          <h3
                            className="text-lg font-semibold mb-4"
                            style={{ color: UI_COLORS.text.heading }}
                          >
                            Notes
                          </h3>
                          <div
                            className="border rounded-lg p-4"
                            style={{
                              borderColor: UI_COLORS.border.default,
                              backgroundColor: UI_COLORS.background.white,
                            }}
                          >
                            <p
                              className="text-sm"
                              style={{
                                color: notes
                                  ? UI_COLORS.text.heading
                                  : UI_COLORS.text.muted,
                              }}
                            >
                              {notes || 'No notes available.'}
                            </p>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="px-6 pb-6 flex gap-4 flex-wrap">
                          <Button
                            className="px-6 py-3 text-base font-medium transition-colors"
                            style={{
                              backgroundColor: UI_COLORS.button.secondary,
                              color: UI_COLORS.button.text,
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                UI_COLORS.button.secondaryHover)
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                UI_COLORS.button.secondary)
                            }
                            onClick={() => onDownloadPdf(attempt.id)}
                          >
                            {isGeneratingPdf === attempt.id
                              ? 'Generating...'
                              : 'Download Chat PDF'}
                          </Button>
                          <Button
                            className="px-6 py-3 text-base font-medium transition-colors"
                            style={{
                              backgroundColor: UI_COLORS.button.secondary,
                              color: UI_COLORS.button.text,
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                UI_COLORS.button.secondaryHover)
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                UI_COLORS.button.secondary)
                            }
                            onClick={() => handleDownloadNotesTxt(attempt.id)}
                          >
                            Download Notes
                          </Button>
                          {attempt.completionStatus === 'Debrief Reached' && (
                            <Button
                              className="px-6 py-3 text-base font-medium transition-colors"
                              style={{
                                backgroundColor: UI_COLORS.button.secondary,
                                color: UI_COLORS.button.text,
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  UI_COLORS.button.secondaryHover)
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  UI_COLORS.button.secondary)
                              }
                              onClick={() => onViewDebrief(attempt.id)}
                              disabled={!!isFetchingDebrief}
                            >
                              {isFetchingDebrief === attempt.id ? (
                                <span className="flex items-center gap-2">
                                  <LoadingIndicator size="sm" />
                                  Loading...
                                </span>
                              ) : (
                                'View AI Debrief'
                              )}
                            </Button>
                          )}
                          <Button
                            className="px-6 py-3 text-base font-medium transition-colors"
                            style={{
                              backgroundColor: UI_COLORS.button.secondary,
                              color: UI_COLORS.button.text,
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                UI_COLORS.button.secondaryHover)
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                UI_COLORS.button.secondary)
                            }
                            onClick={() =>
                              setShowSubmissionsMap((prev) => ({
                                ...prev,
                                [attempt.id]: !prev[attempt.id],
                              }))
                            }
                          >
                            Submissions
                          </Button>
                        </div>

                        {/* Submissions Panel (toggled by button) */}
                        {showSubmissionsMap[attempt.id] && (() => {
                          const dtps = studentPatientData?.dtpSubmissions[attempt.id];
                          const recs = studentPatientData?.recommendationSubmissions[attempt.id];
                          const hasDtps = dtps && dtps.length > 0;
                          const hasRecs = recs && recs.length > 0;
                          return (
                            <div className="px-6 pb-6 space-y-4">
                              {!hasDtps && !hasRecs ? (
                                <p className="text-sm italic" style={{ color: UI_COLORS.text.muted }}>
                                  No submissions yet.
                                </p>
                              ) : (
                                <>
                                  {hasDtps && (
                                    <div
                                      className="border rounded-lg p-4"
                                      style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
                                    >
                                      <p className="text-sm font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>
                                        Drug Therapy Problems
                                      </p>
                                      <ul className="space-y-1 list-disc list-inside">
                                        {dtps!.map((dtp, i) => (
                                          <li key={i} className="text-sm" style={{ color: UI_COLORS.text.body }}>
                                            {dtp}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {hasRecs && (
                                    <div
                                      className="border rounded-lg p-4"
                                      style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
                                    >
                                      <p className="text-sm font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>
                                        Recommendations &amp; Rationale
                                      </p>
                                      <div className="space-y-3">
                                        {recs!.map((rec, i) => (
                                          <div key={i} className="border-l-2 pl-3" style={{ borderColor: UI_COLORS.border.default }}>
                                            <p className="text-sm font-medium" style={{ color: UI_COLORS.text.heading }}>
                                              {rec.recommendation}
                                            </p>
                                            {rec.rationale && (
                                              <p className="text-sm mt-0.5" style={{ color: UI_COLORS.text.body }}>
                                                <span className="font-medium">Rationale:</span> {rec.rationale}
                                              </p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
