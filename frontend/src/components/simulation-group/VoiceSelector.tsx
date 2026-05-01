import { Volume2 } from 'lucide-react';
import { UI_COLORS } from '@/lib/colors';
import { getVoicesByAccent, VOICES, type VoiceOption } from '@/lib/voice-constants';

interface VoiceSelectorProps {
  value: string;
  onChange: (voiceId: string) => void;
}

const voiceGroups = getVoicesByAccent();

export default function VoiceSelector({ value, onChange }: VoiceSelectorProps) {
  const selected: VoiceOption | undefined = VOICES.find((v) => v.id === value);

  return (
    <div className="space-y-3">
      {voiceGroups.map((group) => (
        <div key={group.accent}>
          <label
            className="text-xs font-medium mb-1.5 block"
            style={{ color: UI_COLORS.text.muted }}
          >
            {group.accent}
          </label>
          <div className="flex flex-wrap gap-2">
            {group.voices.map((voice) => {
              const isSelected = value === voice.id;
              return (
                <button
                  key={voice.id}
                  type="button"
                  onClick={() => onChange(voice.id)}
                  className="rounded-lg p-2.5 text-left transition-all"
                  style={{
                    backgroundColor: isSelected
                      ? UI_COLORS.background.tableHeader
                      : UI_COLORS.background.white,
                    borderWidth: '2px',
                    borderStyle: 'solid',
                    borderColor: isSelected
                      ? UI_COLORS.button.primary
                      : UI_COLORS.border.default,
                    cursor: 'pointer',
                    minWidth: '130px',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: isSelected
                          ? UI_COLORS.button.primary
                          : UI_COLORS.border.light,
                      }}
                    >
                      <Volume2
                        className="w-3.5 h-3.5"
                        style={{ color: isSelected ? '#fff' : UI_COLORS.text.muted }}
                      />
                    </div>
                    <div>
                      <p
                        className="font-semibold text-sm leading-tight"
                        style={{ color: UI_COLORS.text.heading }}
                      >
                        {voice.name}
                      </p>
                      <p className="text-xs" style={{ color: UI_COLORS.text.muted }}>
                        {voice.gender}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {!selected && (
        <p className="text-xs" style={{ color: UI_COLORS.status.error }}>
          Please select a voice for this patient.
        </p>
      )}
    </div>
  );
}
