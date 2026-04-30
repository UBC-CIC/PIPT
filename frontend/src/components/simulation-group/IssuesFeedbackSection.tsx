import { useState } from 'react';
import { Trash2, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { UI_COLORS } from '@/lib/colors';
import type { IssueReport, DebriefFeedback } from '@/services/adminApiService';

export interface IssuesFeedbackSectionProps {
  issueReports: IssueReport[];
  debriefFeedback: DebriefFeedback[];
  loading: boolean;
  onDeleteIssueReport: (reportId: string) => void;
  onDeleteDebriefFeedback: (feedbackId: string) => void;
}

/**
 * Format a timestamp into a relative or short date string.
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 1) {
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 1) return 'Just now';
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Get a display name from student fields, falling back to email.
 */
function studentDisplayName(
  firstName: string | null,
  lastName: string | null,
  email: string | null
): string {
  if (firstName && lastName) return `${firstName} ${lastName}`;
  if (firstName) return firstName;
  return email || 'Unknown';
}

export function IssuesFeedbackSection({
  issueReports,
  debriefFeedback,
  loading,
  onDeleteIssueReport,
  onDeleteDebriefFeedback,
}: IssuesFeedbackSectionProps) {
  const [activeTab, setActiveTab] = useState<'issues' | 'feedback'>('issues');
  const [expandedReportIds, setExpandedReportIds] = useState<Set<string>>(new Set());
  const [expandedFeedbackIds, setExpandedFeedbackIds] = useState<Set<string>>(new Set());

  // Summary stats
  const totalReports = issueReports.length;
  const totalFeedback = debriefFeedback.length;
  const helpfulCount = debriefFeedback.filter((f) => f.is_helpful).length;
  const helpfulPercent = totalFeedback > 0 ? Math.round((helpfulCount / totalFeedback) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p style={{ color: UI_COLORS.text.muted }}>Loading issues &amp; feedback...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl p-8">
      {/* Tab Toggle */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: UI_COLORS.background.tableHeader }}>
        {(['issues', 'feedback'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-colors"
            style={{
              backgroundColor: activeTab === tab ? UI_COLORS.background.white : 'transparent',
              color: activeTab === tab ? UI_COLORS.text.heading : UI_COLORS.text.muted,
              border: 'none',
              cursor: 'pointer',
              boxShadow: activeTab === tab ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            {tab === 'issues' ? `Issue Reports (${totalReports})` : `Debrief Feedback (${totalFeedback})`}
          </button>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="flex gap-4">
        {activeTab === 'issues' ? (
          <div
            className="flex-1 rounded-lg p-4"
            style={{
              backgroundColor: UI_COLORS.background.white,
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: UI_COLORS.border.default,
            }}
          >
            <p className="text-sm font-medium" style={{ color: UI_COLORS.text.muted }}>Total Reports</p>
            <p className="text-2xl font-bold mt-1" style={{ color: UI_COLORS.text.heading }}>{totalReports}</p>
          </div>
        ) : (
          <>
            <div
              className="flex-1 rounded-lg p-4"
              style={{
                backgroundColor: UI_COLORS.background.white,
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: UI_COLORS.border.default,
              }}
            >
              <p className="text-sm font-medium" style={{ color: UI_COLORS.text.muted }}>Total Feedback</p>
              <p className="text-2xl font-bold mt-1" style={{ color: UI_COLORS.text.heading }}>{totalFeedback}</p>
            </div>
            <div
              className="flex-1 rounded-lg p-4"
              style={{
                backgroundColor: UI_COLORS.background.white,
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: UI_COLORS.border.default,
              }}
            >
              <p className="text-sm font-medium" style={{ color: UI_COLORS.text.muted }}>Found Helpful</p>
              <p className="text-2xl font-bold mt-1" style={{ color: UI_COLORS.text.heading }}>
                {totalFeedback > 0 ? `${helpfulPercent}%` : '—'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Issue Reports Table */}
      {activeTab === 'issues' && (
        <div
          className="border rounded-lg overflow-hidden"
          style={{ borderColor: UI_COLORS.border.default }}
        >
          {/* Header */}
          <div
            className="grid gap-4 px-6 py-4"
            style={{
              backgroundColor: UI_COLORS.background.tableHeader,
              gridTemplateColumns: '1.5fr 1.5fr 2fr 1fr auto',
            }}
          >
            {['Patient', 'Student', 'Categories', 'Submitted', 'Actions'].map((h) => (
              <div key={h} className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
                {h}
              </div>
            ))}
          </div>

          {/* Rows */}
          {totalReports === 0 ? (
            <div className="px-6 py-8 text-center" style={{ color: UI_COLORS.text.muted }}>
              No issue reports submitted yet.
            </div>
          ) : (
            issueReports.map((report) => {
              const isExpanded = expandedReportIds.has(report.report_id);
              return (
                <div key={report.report_id}>
                  <div
                    className="grid gap-4 px-6 py-4 border-t items-center"
                    style={{
                      borderColor: UI_COLORS.border.default,
                      gridTemplateColumns: '1.5fr 1.5fr 2fr 1fr auto',
                    }}
                  >
                    <div className="text-sm" style={{ color: UI_COLORS.text.heading }}>
                      {report.patient_name || 'Unknown'}
                    </div>
                    <div>
                      <div className="text-sm" style={{ color: UI_COLORS.text.heading }}>
                        {studentDisplayName(report.student_first_name, report.student_last_name, report.student_email)}
                      </div>
                      {report.student_email && (
                        <div className="text-xs" style={{ color: UI_COLORS.text.muted }}>
                          {report.student_email}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {report.issue_categories.map((cat) => (
                        <span
                          key={cat}
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: UI_COLORS.border.light,
                            color: UI_COLORS.text.body,
                          }}
                        >
                          {cat}
                        </span>
                      ))}
                      {report.details && (
                        <button
                          onClick={() => setExpandedReportIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(report.report_id)) next.delete(report.report_id);
                            else next.add(report.report_id);
                            return next;
                          })}
                          className="inline-flex items-center gap-0.5 text-xs font-medium p-0 bg-transparent border-0 cursor-pointer"
                          style={{ color: UI_COLORS.text.muted }}
                        >
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          Details
                        </button>
                      )}
                    </div>
                    <div className="text-xs" style={{ color: UI_COLORS.text.muted }}>
                      {formatDate(report.submitted_at)}
                    </div>
                    <div>
                      <button
                        onClick={() => onDeleteIssueReport(report.report_id)}
                        className="p-2 rounded-md transition-colors"
                        style={{ border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = UI_COLORS.background.hoverLight;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        aria-label="Delete issue report"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" style={{ color: UI_COLORS.status.error }} />
                      </button>
                    </div>
                  </div>
                  {/* Expanded details */}
                  {isExpanded && report.details && (
                    <div
                      className="px-6 pb-4"
                      style={{ borderTopWidth: 0 }}
                    >
                      <div
                        className="rounded-md p-3 text-sm"
                        style={{
                          backgroundColor: UI_COLORS.background.input,
                          color: UI_COLORS.text.body,
                        }}
                      >
                        {report.details}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Debrief Feedback Table */}
      {activeTab === 'feedback' && (
        <div
          className="border rounded-lg overflow-hidden"
          style={{ borderColor: UI_COLORS.border.default }}
        >
          {/* Header */}
          <div
            className="grid gap-4 px-6 py-4"
            style={{
              backgroundColor: UI_COLORS.background.tableHeader,
              gridTemplateColumns: '1.5fr 1.5fr 1fr 2fr 1fr auto',
            }}
          >
            {['Patient', 'Student', 'Helpful?', 'Comment', 'Submitted', 'Actions'].map((h) => (
              <div key={h} className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
                {h}
              </div>
            ))}
          </div>

          {/* Rows */}
          {totalFeedback === 0 ? (
            <div className="px-6 py-8 text-center" style={{ color: UI_COLORS.text.muted }}>
              No debrief feedback submitted yet.
            </div>
          ) : (
            debriefFeedback.map((fb) => {
              const isExpanded = expandedFeedbackIds.has(fb.feedback_id);
              return (
                <div key={fb.feedback_id}>
                  <div
                    className="grid gap-4 px-6 py-4 border-t items-center"
                    style={{
                      borderColor: UI_COLORS.border.default,
                      gridTemplateColumns: '1.5fr 1.5fr 1fr 2fr 1fr auto',
                    }}
                  >
                    <div className="text-sm" style={{ color: UI_COLORS.text.heading }}>
                      {fb.patient_name || 'Unknown'}
                    </div>
                    <div>
                      <div className="text-sm" style={{ color: UI_COLORS.text.heading }}>
                        {studentDisplayName(fb.student_first_name, fb.student_last_name, fb.student_email)}
                      </div>
                      {fb.student_email && (
                        <div className="text-xs" style={{ color: UI_COLORS.text.muted }}>
                          {fb.student_email}
                        </div>
                      )}
                    </div>
                    <div>
                      {fb.is_helpful ? (
                        <span className="inline-flex items-center gap-1 text-sm font-medium" style={{ color: UI_COLORS.status.success }}>
                          <CheckCircle className="w-4 h-4" /> Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-sm font-medium" style={{ color: UI_COLORS.status.error }}>
                          <XCircle className="w-4 h-4" /> No
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {fb.comment ? (
                        <>
                          <span
                            className="text-sm truncate"
                            style={{ color: UI_COLORS.text.body, maxWidth: '200px' }}
                          >
                            {fb.comment}
                          </span>
                          <button
                            onClick={() => setExpandedFeedbackIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(fb.feedback_id)) next.delete(fb.feedback_id);
                              else next.add(fb.feedback_id);
                              return next;
                            })}
                            className="inline-flex items-center gap-0.5 text-xs font-medium p-0 bg-transparent border-0 cursor-pointer flex-shrink-0"
                            style={{ color: UI_COLORS.text.muted }}
                          >
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        </>
                      ) : (
                        <span className="text-xs" style={{ color: UI_COLORS.text.light }}>—</span>
                      )}
                    </div>
                    <div className="text-xs" style={{ color: UI_COLORS.text.muted }}>
                      {formatDate(fb.submitted_at)}
                    </div>
                    <div>
                      <button
                        onClick={() => onDeleteDebriefFeedback(fb.feedback_id)}
                        className="p-2 rounded-md transition-colors"
                        style={{ border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = UI_COLORS.background.hoverLight;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        aria-label="Delete feedback"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" style={{ color: UI_COLORS.status.error }} />
                      </button>
                    </div>
                  </div>
                  {/* Expanded comment */}
                  {isExpanded && fb.comment && (
                    <div className="px-6 pb-4">
                      <div
                        className="rounded-md p-3 text-sm"
                        style={{
                          backgroundColor: UI_COLORS.background.input,
                          color: UI_COLORS.text.body,
                        }}
                      >
                        {fb.comment}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
