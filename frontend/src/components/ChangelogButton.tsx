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
