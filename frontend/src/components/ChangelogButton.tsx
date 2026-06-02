import { useState, useRef, useEffect } from 'react';
import { X, Megaphone } from 'lucide-react';
import { SIMULATION_GROUP_COLOR_PALETTE, UI_COLORS } from '@/lib/colors';

type Status = 'working' | 'in-progress' | 'not-working';

interface ChangelogItem {
  feature: string;
  status: Status;
  note?: string;
}

interface ChangelogEntry {
  date: string;
  items: ChangelogItem[];
}

const changelog: ChangelogEntry[] = [
  {
    date: 'May 28, 2026',
    items: [
      { feature: 'Accordion expand/collapse for admin DTP, Rec, and Question Bank entries', status: 'working', note: 'admin can now expand any DTP, recommendation, or question bank item to preview its full details before including or excluding it — matches the instructor experience' },
      { feature: 'Tags visible on accordion trigger row', status: 'working', note: 'question, DTP, and recommendation tags appear inline on the collapsed row so admins can filter at a glance without opening the accordion' },
      { feature: 'Edit patient panel DTP & recommendation fields aligned to key questions', status: 'working', note: 'DTP and recommendation edit forms are now fully 1:1 with the key questions panel layout' },
      { feature: 'Instructor question bank patient-specific tab filtering fixed', status: 'working', note: 'patient-specific questions (persona_id not null) now correctly appear only in the Patient-Specific tab instead of showing in the Global tab' },
    ],
  },
  {
    date: 'May 27, 2026',
    items: [
      { feature: 'Student debrief now shows submitted DTPs and recommendations', status: 'working', note: 'the AI Debrief dialog displays the exact drug therapy problems and recommendations you submitted at conclude time, so you can follow along as the AI scores each one' },
      { feature: 'Instructor & admin session view shows student submissions', status: 'working', note: 'the Submissions panel in Manage Students now correctly displays the DTPs and recommendations a student submitted for each concluded session' },
      { feature: 'Debrief feedback flow reordered', status: 'working', note: 'the optional comment field now appears before the Yes / No buttons so it\'s clear the comment can be filled in before submitting' },
    ],
  },
  {
    date: 'May 15, 2026',
    items: [
      { feature: 'Interview Practice mode for patients', status: 'working', note: 'patients with no DTPs & Recommendations assigned are automatically marked as "Interview Practice" — no extra setup needed' },
      { feature: 'Interview Practice badge visible to all roles', status: 'working', note: 'students, instructors, and admins can see which patients are interview-only vs regular (full assessment)' },
      { feature: 'Conclude interaction is mode-aware', status: 'working', note: 'interview practice patients get a simple confirmation, full assessment patients go through the DTP + Recommendations steps' },
      { feature: 'Debrief Dialog hides DTP/Rec comparison for interview practice', status: 'working', note: 'interview practice debriefs only show the interview summary and key questions feedback (STILL MOCK DATA)' },
      { feature: 'DTP & Recommendation assign/unassign fully wired', status: 'working', note: 'toggling assignments on/off now persists to the backend with success/error notifications' },
      { feature: 'Patient list refreshes after assignment changes', status: 'working', note: 'the Interview Practice badge updates immediately without a page reload' },
    ],
  },
  {
    date: 'May 14, 2026',
    items: [
      { feature: 'Organization create & delete fully functional', status: 'working', note: 'admins can now create and delete organizations end-to-end (no longer mock)' },
      { feature: 'DTP & Recommendations bank wired to backend', status: 'working', note: 'Org-wide DTP and Recommendations bank items are no longer mock' },
      { feature: 'Org-wide banks pre-populated from sponsor documents', status: 'working', note: 'DTP bank and Recommendations bank seeded with content from the sponsor documents' },
      { feature: 'Inline edit & expandable preview for bank items', status: 'working', note: 'expand any DTP or Recommendation to preview full details; click the pencil to edit in place' },
      { feature: 'Toast notifications on bank operations', status: 'working', note: 'success/error toasts for creating, editing, and deleting DTP and Recommendation items' },
      { feature: 'Expandable preview in sim group assignment view', status: 'working', note: 'DTP and Recommendation cards in the assignment section can be expanded to inspect content before assigning' },
    ],
  },
  {
    date: 'May 13, 2026',
    items: [
      { feature: 'Debrief tone reworked', status: 'working', note: 'soft-skills-only summary with reflective guiding questions for missed key questions, plus AI disclaimer subtitle' },
      { feature: 'Debrief feedback & issue reports saved to backend', status: 'working', note: '"Was this helpful?" and Report Issue dialogs now persist to the database instead of console.log' },
      { feature: 'Instructor email validation on elevation', status: 'working', note: 'rejects unregistered users with a toast error when trying to add them as instructors' },
      { feature: 'Admin/Instructor preview mode navigation fix', status: 'working', note: '"Back to Admin/Instructor View" button persists through chat and history pages in student preview mode' },
      { feature: 'Analytics exclude preview activity', status: 'working', note: 'admin/instructor test sessions no longer skew student analytics dashboards' },
      { feature: 'Stale data fix on group navigation', status: 'working', note: 'switching between simulation groups now refreshes data correctly' },
      { feature: 'No-memory disclaimer in student chat history', status: 'working', note: 'students see a note that the AI does not retain memory across sessions' },
      { feature: 'Sidebar renamed "Rubric" to "Key Questions"', status: 'working' },
      { feature: 'Create simulation group dialog stays open on outside click', status: 'working', note: 'prevents accidental loss of form data' },
    ],
  },
  {
    date: 'May 6, 2026',
    items: [
      { feature: 'Voice preview moved into Edit Patient panel', status: 'working', note: 'test patient voice directly from the patient editor with mic-based single-exchange flow' },
      { feature: 'Voice ID selector for patients', status: 'working', note: 'choose from English-only voice options per patient' },
      { feature: 'System & patient prompt guidance', status: 'working', note: 'helper text and better examples added to prompt editing fields' },
      { feature: 'Character limit on textareas', status: 'working', note: 'prevents excessively long prompts and descriptions' },
      { feature: 'Input controls disabled during AI streaming', status: 'working', note: 'prevents sending messages while the AI is still responding' },
      { feature: 'Voice preview mic fix', status: 'working', note: 'mic now properly stops during response streaming' },
      { feature: 'Patient card sizing and layout fixes', status: 'working', note: 'resized view patient cards, fixed start new chat button position on empty landing page' },
      { feature: 'Duplicate patients filtered in admin student preview', status: 'working' },
    ],
  },
  {
    date: 'April 30, 2026',
    items: [
      { feature: 'Voice preview for patients (mic-based)', status: 'working', note: 'admins can test patient voice responses with a single-exchange mic flow before saving' },
      { feature: 'Report issue & debrief feedback dialogs', status: 'working', note: 'UI for reporting issues and rating debriefs added to admin-side patient view' },
      { feature: 'Inline file preview in Edit Patient panel', status: 'working', note: 'preview uploaded documents directly within the patient editor' },
      { feature: 'New app icon', status: 'working' },
      { feature: 'Loading animations added', status: 'working' },
      { feature: 'File delete UI with embedding cleanup', status: 'working', note: 'deleting a patient file now also removes its vector embeddings' },
    ],
  },
  {
    date: 'April 25, 2026',
    items: [
      { feature: 'Real-time voice chat transcript bubbles', status: 'working', note: 'user and AI text now streams live during voice mode instead of fetching from DB!' },
      { feature: 'Voice transcript spacing and capitalization', status: 'working', note: 'proper word spacing, sentence capitalization, and pronoun "I" correction in saved transcripts' },
      { feature: 'Voice turn-taking sensitivity tuned to MEDIUM', status: 'working', note: 'reduces AI barge-ins when students pause to think' },
      { feature: 'Stronger patient role adherence', status: 'working', note: 'non-negotiable guardrails prevent the AI from breaking character, over-sharing, or using formal/academic tone' },
      { feature: 'Natural voice tone guidance', status: 'working', note: 'AI matches vocal tone to context: uncomfortable for pain, uncertain when unsure, not flat or cheerful' },
      { feature: 'Session auto-lock on completion', status: 'working', note: 'chat input is disabled and a conclude banner appears when the patient ends the conversation (text and voice)' },
      { feature: 'Mute/unmute reliability in voice mode', status: 'working', note: 'muting now properly closes the audio stream so unmuting resumes instantly' },
      { feature: 'Session completion persists across navigation', status: 'working', note: 'returning to a completed chat still shows the banner prompting students to generate debrief' },
    ],
  },
  {
    date: 'April 16, 2026',
    items: [
      { feature: 'Prompt playground for admins', status: 'working', note: 'can simulate interactions with the Persona for both debrief and chat before saving it' },
      { feature: 'Ability to rename patient documents', status: 'working', note: 'display name for patient information is used in student view instead of the raw filename' },
      { feature: 'Report issue dialog', status: 'not-working', note: 'UI exists but reports are not saved to the backend yet' },
      { feature: 'Custom toast notifications', status: 'working', note: 'replaced all browser alert() dialogs with a custom toast notification system' },
      ],
  },
  {
    date: 'April 15, 2026',
    items: [
      { feature: 'Per-patient voice enable/disable toggle', status: 'working' },
      { feature: 'Simulation group-wide toggle for voice (enables/disables all patients)', status: 'working' },
      { feature: 'Mic button hidden for students when voice is disabled', status: 'working' },
    ],
  },
  {
    date: 'April 10, 2026',
    items: [
      { feature: 'Voice mode', status: 'working', note: 'us-east-1 only' },
      { feature: 'Text chat with streaming responses', status: 'working' },
      { feature: 'AI debrief generation', status: 'working' },
      { feature: 'Question bank management (global + case-specific)', status: 'working' },
      { feature: 'Student analytics dashboard', status: 'working' },
      { feature: 'Physical assessment media (Kaltura/Panopto/H5P embeds)', status: 'working' },
      { feature: 'Case materials & file uploads (documents, info, answer keys)', status: 'working' },
      { feature: 'Profile pictures for patients', status: 'working' },
      { feature: 'Session conclude & debrief flow', status: 'working' },
      { feature: 'Chat history & session management', status: 'working' },
      { feature: 'Instructor prompt editing (system + debrief)', status: 'working' },
      { feature: 'Student enrollment via access codes', status: 'working' },
      { feature: 'Admin organization & group management', status: 'working' },
    ],
  },
];

// status helpers

const STATUS_CONFIG: Record<Status, { label: string; bg: string; text: string }> = {
  working:       { label: 'Working',     bg: UI_COLORS.changelog.workingBg, text: UI_COLORS.changelog.workingText },
  "in-progress": { label: 'In Progress', bg: UI_COLORS.changelog.inProgressBg, text: UI_COLORS.changelog.inProgressText },
  'not-working': { label: 'Not Working', bg: UI_COLORS.changelog.notWorkingBg, text: UI_COLORS.changelog.notWorkingText },
};

function StatusBadge({ status }: { status: Status }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      {cfg.label}
    </span>
  );
}

// component

export default function ChangelogButton() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={panelRef} className="fixed bottom-6 right-6 z-50">
      {/* Dropdown panel — opens upward */}
      {open && (
        <div
          className="absolute bottom-16 right-0 w-[420px] max-h-[70vh] rounded-2xl shadow-2xl border overflow-hidden flex flex-col"
          style={{
            backgroundColor: UI_COLORS.background.white,
            borderColor: UI_COLORS.border.default,
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 border-b"
            style={{
              background: `linear-gradient(135deg, ${SIMULATION_GROUP_COLOR_PALETTE[2]}, ${UI_COLORS.gradient.loginEnd})`,
              borderColor: UI_COLORS.border.default,
            }}
          >
            <h3 className="text-base font-bold" style={{ color: UI_COLORS.button.text }}>Changelog &amp; Known Issues</h3>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-full hover:bg-white/20 transition-colors"
              aria-label="Close changelog"
            >
              <X className="w-5 h-5" style={{ color: UI_COLORS.button.text }} />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            {changelog.map((entry) => (
              <div key={entry.date}>
                {/* Date header */}
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="h-px flex-1"
                    style={{ backgroundColor: UI_COLORS.border.default }}
                  />
                  <span
                    className="text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: UI_COLORS.text.muted }}
                  >
                    {entry.date}
                  </span>
                  <div
                    className="h-px flex-1"
                    style={{ backgroundColor: UI_COLORS.border.default }}
                  />
                </div>

                {/* Items */}
                <ul className="space-y-2">
                  {entry.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <StatusBadge status={item.status} />
                      <div className="flex-1 min-w-0">
                        <span
                          className="text-sm leading-snug"
                          style={{ color: UI_COLORS.text.heading }}
                        >
                          {item.feature}
                        </span>
                        {item.note && (
                          <p
                            className="text-xs mt-0.5 leading-snug"
                            style={{ color: UI_COLORS.text.muted }}
                          >
                            {item.note}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 px-7 py-4 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95"
        style={{
          background: `linear-gradient(135deg, ${SIMULATION_GROUP_COLOR_PALETTE[2]}, ${UI_COLORS.gradient.loginEnd})`,
          color: UI_COLORS.button.text,
          border: 'none',
          cursor: 'pointer',
          fontSize: '1rem',
        }}
        aria-label="Open changelog"
      >
        <Megaphone className="w-6 h-6" />
        <span className="font-bold tracking-wide">What&apos;s New</span>
        {/* Pulse dot */}
        <span className="relative flex h-3 w-3">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: UI_COLORS.changelog.pulseDot }}
          />
          <span
            className="relative inline-flex rounded-full h-3 w-3"
            style={{ backgroundColor: UI_COLORS.changelog.pulseDot }}
          />
        </span>
      </button>
    </div>
  );
}
